import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logSystemEvent } from '@/lib/systemLogger';
import { format, formatDistanceToNow } from 'date-fns';

interface PendingResetRequest {
  id: string;
  requested_by: string;
  reason: string | null;
  created_at: string;
  requester_name?: string;
}

export function DataResetSection() {
  const { user } = useAuth();
  const [dialogStep, setDialogStep] = useState<'closed' | 'warning' | 'reason' | 'confirm'>('closed');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingResetRequest | null>(null);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  // Check if current user is primary admin and fetch pending requests
  useEffect(() => {
    async function checkStatus() {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // Check if user is primary admin
        const { data: isPrimary } = await supabase
          .rpc('is_primary_admin', { _user_id: user.id });
        setIsPrimaryAdmin(isPrimary || false);

        // Fetch pending reset request
        const { data: requests } = await supabase
          .from('approval_requests')
          .select('id, requested_by, reason, created_at')
          .eq('request_type', 'data_reset')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        if (requests && requests.length > 0) {
          const request = requests[0];
          
          // Check if expired (24 hours)
          const createdAt = new Date(request.created_at);
          const now = new Date();
          const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceCreation < 24) {
            // Fetch requester name
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, username')
              .eq('user_id', request.requested_by)
              .single();
            
            setPendingRequest({
              ...request,
              requester_name: profile?.full_name || profile?.username || 'Unknown User'
            });
          } else {
            // Mark as expired
            await supabase
              .from('approval_requests')
              .update({ status: 'rejected', review_notes: 'Expired after 24 hours' })
              .eq('id', request.id);
            setPendingRequest(null);
          }
        } else {
          setPendingRequest(null);
        }
      } catch (error) {
        console.error('Error checking status:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkStatus();
  }, [user]);

  const handleOpenDialog = () => {
    if (pendingRequest) {
      toast.error('A reset request is already pending');
      return;
    }
    setDialogStep('warning');
  };

  const handleCloseDialog = () => {
    setDialogStep('closed');
    setReason('');
    setConfirmText('');
  };

  const handleSubmitRequest = async () => {
    if (!user || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      // Refresh auth session before critical operations
      await supabase.auth.refreshSession();

      // Create approval request
      const { data, error } = await supabase
        .from('approval_requests')
        .insert({
          request_type: 'data_reset',
          requested_by: user.id,
          reason: reason.trim(),
          status: 'pending',
          metadata: { confirmation_phrase: 'RESET ALL DATA' }
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create approval request:', error);
        throw error;
      }

      // Non-blocking: Log the request
      try {
        await logSystemEvent({
          eventType: 'data_reset_requested',
          description: 'Data reset requested',
          metadata: { reason: reason.trim() }
        });
      } catch (e) {
        console.error('Non-critical: failed to log system event', e);
      }

      if (isPrimaryAdmin) {
        // Primary admin: directly execute the reset
        handleCloseDialog();
        setIsExecuting(true);

        const { data: resetData, error: resetError } = await supabase.functions.invoke('data-reset', {
          body: { approval_request_id: data.id }
        });

        if (resetError) {
          console.error('Edge function invocation error:', resetError);
          throw new Error('Failed to execute data reset');
        }

        if (resetData?.error) {
          console.error('Data reset returned error:', resetData.error);
          throw new Error(resetData.error);
        }

        toast.success('Data reset completed successfully');
        setPendingRequest(null);

        // Refresh the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        // Non-primary admin: notify and wait
        try {
          const { data: primaryAdminId } = await supabase.rpc('get_primary_admin_id');
          if (primaryAdminId && primaryAdminId !== user.id) {
            await supabase.from('notifications').insert({
              user_id: primaryAdminId,
              title: 'Data Reset Request',
              message: 'An admin has requested a full data reset. Your approval is required.',
              type: 'warning',
              category: 'system',
              action_url: '/settings',
              metadata: { approval_request_id: data.id }
            });
          }
        } catch (e) {
          console.error('Non-critical: failed to send notification', e);
        }

        toast.success('Reset request submitted. Waiting for primary admin approval.');

        setPendingRequest({
          id: data.id,
          requested_by: user.id,
          reason: reason.trim(),
          created_at: data.created_at,
          requester_name: 'You'
        });

        handleCloseDialog();
      }
    } catch (error) {
      console.error('Error in data reset flow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit reset request');
    } finally {
      setIsSubmitting(false);
      setIsExecuting(false);
    }
  };

  const handleApproveReset = async () => {
    if (!pendingRequest || !isPrimaryAdmin) return;

    setIsExecuting(true);
    try {
      // Call edge function to execute reset
      const { data, error } = await supabase.functions.invoke('data-reset', {
        body: { approval_request_id: pendingRequest.id }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Data reset completed successfully');
      setPendingRequest(null);

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error executing reset:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute data reset');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRejectReset = async () => {
    if (!pendingRequest || !isPrimaryAdmin) return;

    try {
      await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: 'Rejected by primary admin'
        })
        .eq('id', pendingRequest.id);

      // Notify requester
      await supabase.from('notifications').insert({
        user_id: pendingRequest.requested_by,
        title: 'Data Reset Rejected',
        message: 'Your data reset request has been rejected by the primary admin.',
        type: 'info',
        category: 'system',
        action_url: '/settings'
      });

      await logSystemEvent({
        eventType: 'data_reset_rejected',
        description: 'Data reset request rejected',
        metadata: { approval_request_id: pendingRequest.id }
      });

      toast.success('Reset request rejected');
      setPendingRequest(null);
    } catch (error) {
      console.error('Error rejecting reset:', error);
      toast.error('Failed to reject reset request');
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest || pendingRequest.requested_by !== user?.id) return;

    try {
      await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          review_notes: 'Cancelled by requester'
        })
        .eq('id', pendingRequest.id);

      toast.success('Reset request cancelled');
      setPendingRequest(null);
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel reset request');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect all system data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pending Request Display */}
          {pendingRequest && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Pending Reset Request
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Requested by {pendingRequest.requester_name}{' '}
                    {formatDistanceToNow(new Date(pendingRequest.created_at), { addSuffix: true })}
                  </p>
                  {pendingRequest.reason && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                      <span className="font-medium">Reason:</span> {pendingRequest.reason}
                    </p>
                  )}
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Expires: {format(new Date(new Date(pendingRequest.created_at).getTime() + 24 * 60 * 60 * 1000), 'PPp')}
                  </p>
                </div>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Pending
                </Badge>
              </div>

              <Separator />

              <div className="flex gap-2">
                {isPrimaryAdmin ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleApproveReset}
                      disabled={isExecuting}
                      className="gap-2"
                    >
                      {isExecuting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Approve & Execute
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRejectReset}
                      disabled={isExecuting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                ) : pendingRequest.requested_by === user?.id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelRequest}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Request
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Waiting for primary admin approval...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Reset Button */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="space-y-1">
              <p className="font-medium">Reset All Data</p>
              <p className="text-sm text-muted-foreground">
                Delete all inventory data including items, locations, categories, and transaction history.
                User accounts and system settings will be preserved.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleOpenDialog}
              disabled={!!pendingRequest}
              className="shrink-0 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Reset All Data
            </Button>
          </div>

          {isPrimaryAdmin && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-3 w-3" />
              You are the primary admin. Only you can approve data reset requests.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multi-step Dialog */}
      <Dialog open={dialogStep !== 'closed'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md">
          {/* Step 1: Warning */}
          {dialogStep === 'warning' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Warning: Data Reset
                </DialogTitle>
                <DialogDescription className="space-y-2 pt-2">
                  <p>
                    This action will permanently delete all inventory data including:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                    <li>All items and item variants</li>
                    <li>All locations</li>
                    <li>All categories</li>
                    <li>All stock transactions</li>
                    <li>All scan logs and usage history</li>
                    <li>All notifications</li>
                  </ul>
                  <p className="font-medium text-foreground mt-3">
                    The following will be preserved:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                    <li>User accounts and roles</li>
                    <li>System settings and policies</li>
                    <li>Audit logs (for compliance)</li>
                  </ul>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => setDialogStep('reason')}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 2: Reason */}
          {dialogStep === 'reason' && (
            <>
              <DialogHeader>
                <DialogTitle>Provide a Reason</DialogTitle>
                <DialogDescription>
                  A reason is required and will be logged for audit purposes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-reason">Reason for reset *</Label>
                  <Textarea
                    id="reset-reason"
                    placeholder="e.g., Starting new inventory cycle, testing complete, migrating to new system..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDialogStep('warning')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDialogStep('confirm')}
                  disabled={!reason.trim()}
                >
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 3: Confirm */}
          {dialogStep === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>Final Confirmation</DialogTitle>
                <DialogDescription>
                  Type <span className="font-mono font-bold text-destructive">RESET ALL DATA</span> to confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Type RESET ALL DATA"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="font-mono"
                />
                {isPrimaryAdmin && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="text-destructive font-medium">
                      As primary admin, the reset will execute immediately after submission.
                    </p>
                  </div>
                )}
                {!isPrimaryAdmin && (
                  <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">
                      Your request will be sent to the primary admin for approval.
                      The reset will only be executed after they approve it.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDialogStep('reason')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSubmitRequest}
                  disabled={confirmText !== 'RESET ALL DATA' || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isPrimaryAdmin ? 'Executing Reset...' : 'Submitting...'}
                    </>
                  ) : (
                    isPrimaryAdmin ? 'Execute Reset Now' : 'Submit Reset Request'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
