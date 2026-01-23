import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Clock, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { ApprovalRequest } from '@/types/database';

export default function Approvals() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; request: ApprovalRequest | null; action: 'approve' | 'reject' | null }>({
    open: false, request: null, action: null
  });
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select(`
          *,
          item:items(id, name, code, current_stock),
          requester:profiles!approval_requests_requested_by_fkey(username, full_name),
          reviewer:profiles!approval_requests_reviewed_by_fkey(username, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as unknown as ApprovalRequest[]) || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load approval requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleReview() {
    if (!reviewDialog.request || !reviewDialog.action) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: reviewDialog.action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq('id', reviewDialog.request.id);

      if (error) throw error;

      // If approved and it's a stock-out, execute the transaction
      if (reviewDialog.action === 'approve' && reviewDialog.request.request_type === 'large_stock_out') {
        const req = reviewDialog.request;
        const metadata = req.metadata as { location_id?: string; notes?: string; recipient?: string };

        // Get current stock
        const { data: item } = await supabase
          .from('items')
          .select('current_stock')
          .eq('id', req.item_id!)
          .single();

        if (item) {
          const newStock = item.current_stock - (req.quantity || 0);

          // Create transaction
          await supabase.from('stock_transactions').insert({
            item_id: req.item_id,
            transaction_type: 'stock_out',
            quantity: -(req.quantity || 0),
            balance_before: item.current_stock,
            balance_after: newStock,
            location_id: metadata?.location_id || null,
            notes: `Approved request: ${req.reason || ''} | ${metadata?.notes || ''}`,
            recipient: metadata?.recipient || null,
            performed_by: req.requested_by,
          });

          // Update item stock
          await supabase
            .from('items')
            .update({ current_stock: newStock })
            .eq('id', req.item_id!);
        }
      }

      toast.success(`Request ${reviewDialog.action === 'approve' ? 'approved' : 'rejected'}`);
      setReviewDialog({ open: false, request: null, action: null });
      setReviewNotes('');
      fetchRequests();
    } catch (error) {
      console.error('Error reviewing request:', error);
      toast.error('Failed to process request');
    } finally {
      setProcessing(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-success/10 text-success border-success/20"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'large_stock_out':
        return <Badge variant="outline"><Package className="h-3 w-3 mr-1" />Large Stock Out</Badge>;
      case 'new_item':
        return <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />New Item</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Requests</h1>
          <p className="text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''} awaiting review` : 'No pending requests'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
          <CardDescription>Review and manage approval requests for stock operations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No approval requests yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="text-sm">
                      {format(new Date(request.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>{getTypeBadge(request.request_type)}</TableCell>
                    <TableCell>
                      {(request as any).item?.name || 'N/A'}
                      <span className="text-xs text-muted-foreground block font-mono">
                        {(request as any).item?.code}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{request.quantity || '-'}</TableCell>
                    <TableCell>
                      {(request as any).requester?.full_name || (request as any).requester?.username}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.status === 'pending' && isAdmin && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success"
                            onClick={() => setReviewDialog({ open: true, request, action: 'approve' })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => setReviewDialog({ open: true, request, action: 'reject' })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && setReviewDialog({ open: false, request: null, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'approve' ? 'Approve' : 'Reject'} Request
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.request?.request_type === 'large_stock_out' && reviewDialog.action === 'approve' 
                ? 'This will execute the stock-out transaction.'
                : 'Add optional notes for this decision.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium">Item: {(reviewDialog.request as any)?.item?.name}</p>
              <p className="text-sm text-muted-foreground">Quantity: {reviewDialog.request?.quantity}</p>
              <p className="text-sm text-muted-foreground">Reason: {reviewDialog.request?.reason || 'No reason provided'}</p>
            </div>
            <Textarea
              placeholder="Add notes (optional)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, request: null, action: null })}>
              Cancel
            </Button>
            <Button
              variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={processing}
            >
              {reviewDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
