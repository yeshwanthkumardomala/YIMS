import { useState, useEffect, useCallback } from 'react';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Package, Clock, AlertCircle } from 'lucide-react';
import type { Item, Location } from '@/types/database';
import { getLocationTypeDisplay } from '@/lib/utils';
import { ActionButtons, type InventoryAction, getActionConfig } from '@/components/inventory/ActionButtons';
import { NegativeStockIndicator } from '@/components/inventory/NegativeStockIndicator';
import { useSystemPolicies } from '@/hooks/useSystemPolicies';
import { Badge } from '@/components/ui/badge';

interface RouterState {
  itemId?: string;
  action?: InventoryAction;
}

interface AppSettings {
  stock_out_approval_threshold?: number;
}

// Map action types to transaction types for database
const ACTION_TO_TRANSACTION: Record<InventoryAction, 'stock_in' | 'stock_out' | 'adjustment'> = {
  issue: 'stock_out',
  return: 'stock_in',
  adjust: 'adjustment',
  consume: 'stock_out',
};

export default function Stock() {
  const { user } = useAuth();
  const routerLocation = useRouterLocation();
  const state = routerLocation.state as RouterState | null;
  
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<InventoryAction>(state?.action || 'issue');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [pendingTransaction, setPendingTransaction] = useState<null | {
    item: Item;
    quantity: number;
    threshold: number;
  }>(null);
  const [settings, setSettings] = useState<AppSettings>({});

  const { negativeStockPolicy, requireReasonPolicy, confirmationThresholds } = useSystemPolicies();

  const [formData, setFormData] = useState({
    item_id: state?.itemId || '',
    quantity: 1,
    location_id: '',
    notes: '',
    recipient: '',
    project_tag: '',
  });

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [lastTransaction, setLastTransaction] = useState<{
    performedBy?: string;
    createdAt?: string;
    notes?: string;
    transactionType?: string;
    quantity?: number;
  } | null>(null);

  // Check if reason is required for current action
  const isReasonRequired = requireReasonPolicy?.[activeAction] ?? false;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [itemsRes, locationsRes, settingsRes] = await Promise.all([
        supabase
          .from('items')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
        supabase.from('app_settings').select('key, value').in('key', ['stock_out_approval_threshold']),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setItems(itemsRes.data || []);
      setLocations(locationsRes.data || []);

      // Parse settings
      const settingsMap: AppSettings = {};
      settingsRes.data?.forEach((s) => {
        if (s.key === 'stock_out_approval_threshold') {
          settingsMap.stock_out_approval_threshold = s.value as number;
        }
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // Pre-select item from navigation state
  useEffect(() => {
    if (state?.itemId && items.length > 0) {
      const item = items.find((i) => i.id === state.itemId);
      if (item) {
        setSelectedItem(item);
        setFormData((prev) => ({ ...prev, item_id: state.itemId || '' }));
        fetchLastTransaction(state.itemId);
      }
    }
  }, [state?.itemId, items]);

  async function fetchLastTransaction(itemId: string) {
    try {
      // First get the transaction
      const { data: txData, error: txError } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (txError && txError.code !== 'PGRST116') throw txError;
      
      if (txData) {
        // Then get the performer's username
        let performerUsername: string | undefined;
        if (txData.performed_by) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', txData.performed_by)
            .single();
          performerUsername = profileData?.username;
        }

        setLastTransaction({
          performedBy: performerUsername,
          createdAt: txData.created_at,
          notes: txData.notes || undefined,
          transactionType: txData.transaction_type,
          quantity: txData.quantity,
        });
      }
    } catch (error) {
      console.error('Error fetching last transaction:', error);
    }
  }

  function handleItemChange(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    setSelectedItem(item || null);
    setFormData({ ...formData, item_id: itemId });
    if (item) {
      fetchLastTransaction(itemId);
    }
  }

  function resetForm() {
    setFormData({
      item_id: '',
      quantity: 1,
      location_id: '',
      notes: '',
      recipient: '',
      project_tag: '',
    });
    setSelectedItem(null);
    setLastTransaction(null);
  }

  function handleActionChange(action: InventoryAction) {
    setActiveAction(action);
  }

  const getBalanceAfter = useCallback(() => {
    if (!selectedItem) return 0;
    
    switch (activeAction) {
      case 'issue':
      case 'consume':
        return selectedItem.current_stock - formData.quantity;
      case 'return':
        return selectedItem.current_stock + formData.quantity;
      case 'adjust':
        return formData.quantity; // Adjustment sets to exact value
      default:
        return selectedItem.current_stock;
    }
  }, [selectedItem, activeAction, formData.quantity]);

  async function submitApprovalRequest() {
    if (!pendingTransaction || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('approval_requests').insert({
        request_type: 'large_stock_out',
        requested_by: user.id,
        item_id: pendingTransaction.item.id,
        quantity: pendingTransaction.quantity,
        threshold_exceeded: pendingTransaction.threshold,
        reason: approvalReason.trim() || null,
        status: 'pending',
        metadata: {
          item_name: pendingTransaction.item.name,
          item_code: pendingTransaction.item.code,
          location_id: formData.location_id || null,
          recipient: formData.recipient.trim() || null,
          notes: formData.notes.trim() || null,
          action: activeAction,
        },
      });

      if (error) throw error;

      toast.success('Approval request submitted. An admin will review your request.');
      setApprovalDialogOpen(false);
      setApprovalReason('');
      setPendingTransaction(null);
      resetForm();
    } catch (error: unknown) {
      console.error('Error submitting approval request:', error);
      toast.error((error as Error).message || 'Failed to submit approval request');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.item_id || formData.quantity <= 0) {
      toast.error('Please select an item and enter a valid quantity');
      return;
    }

    if (!selectedItem) {
      toast.error('Item not found');
      return;
    }

    // Check if reason is required
    if (isReasonRequired && !formData.notes.trim()) {
      toast.error(`Reason/notes is required for ${activeAction} operations`);
      return;
    }

    // Check if approval is required for large stock-outs
    const threshold = confirmationThresholds?.stock_out || settings.stock_out_approval_threshold || 0;
    if ((activeAction === 'issue' || activeAction === 'consume') && threshold > 0 && formData.quantity > threshold) {
      setPendingTransaction({
        item: selectedItem,
        quantity: formData.quantity,
        threshold,
      });
      setApprovalDialogOpen(true);
      return;
    }

    // Check for negative stock warning
    const balanceAfter = getBalanceAfter();
    if ((activeAction === 'issue' || activeAction === 'consume') && balanceAfter < 0) {
      if (!negativeStockPolicy?.allowed) {
        toast.error('Negative stock is not allowed. Cannot proceed with this operation.');
        return;
      }
      
      if (negativeStockPolicy.max_threshold && balanceAfter < negativeStockPolicy.max_threshold) {
        toast.error(`This would exceed the maximum negative threshold (${negativeStockPolicy.max_threshold})`);
        return;
      }

      const confirmed = confirm(
        `Warning: This will result in negative stock (${balanceAfter}). Are you sure you want to proceed?`
      );
      if (!confirmed) return;
    }

    await processTransaction();
  }

  async function processTransaction() {
    if (!selectedItem || !user) return;

    setSubmitting(true);
    try {
      const balanceBefore = selectedItem.current_stock;
      const balanceAfter = getBalanceAfter();
      const transactionType = ACTION_TO_TRANSACTION[activeAction];

      // Create transaction
      const { error: transactionError } = await supabase.from('stock_transactions').insert({
        item_id: formData.item_id,
        transaction_type: transactionType,
        quantity: Math.abs(activeAction === 'adjust' ? balanceAfter - balanceBefore : formData.quantity),
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        location_id: formData.location_id || null,
        notes: formData.notes.trim() || `Action: ${activeAction}${formData.project_tag ? ` | Project: ${formData.project_tag}` : ''}`,
        recipient: formData.recipient.trim() || null,
        performed_by: user?.id,
      });

      if (transactionError) throw transactionError;

      // Update item stock
      const { error: updateError } = await supabase
        .from('items')
        .update({ current_stock: balanceAfter })
        .eq('id', formData.item_id);

      if (updateError) throw updateError;

      const actionConfig = getActionConfig(activeAction);
      toast.success(
        `${actionConfig.label}: ${formData.quantity} ${selectedItem.unit} of ${selectedItem.name}`
      );

      resetForm();
      fetchData();
    } catch (error: unknown) {
      console.error('Error processing stock operation:', error);
      toast.error((error as Error).message || 'Failed to process stock operation');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const actionConfig = getActionConfig(activeAction);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Operations</h1>
        <p className="text-muted-foreground">Record inventory movements using action-based workflow</p>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Action</CardTitle>
          <CardDescription>Choose the type of inventory operation</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButtons
            onAction={handleActionChange}
            activeAction={activeAction}
            size="default"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stock Operation Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = actionConfig.icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {actionConfig.label}
                </CardTitle>
                <CardDescription>{actionConfig.description}</CardDescription>
              </div>
              <Badge variant={actionConfig.variant === 'destructive' ? 'destructive' : 'secondary'}>
                {actionConfig.shortcut} key
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="item">Item *</Label>
                  <Select value={formData.item_id} onValueChange={handleItemChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="flex items-center gap-2">
                            {item.name}
                            <span className={item.current_stock < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                              ({item.current_stock} {item.unit})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">
                    {activeAction === 'adjust' ? 'New Stock Level *' : 'Quantity *'}
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={activeAction === 'adjust' ? undefined : '1'}
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              {/* Negative stock warning */}
              {selectedItem && (activeAction === 'issue' || activeAction === 'consume') && 
               formData.quantity > selectedItem.current_stock && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>
                    Warning: This will result in negative stock ({getBalanceAfter()} {selectedItem.unit})
                  </span>
                </div>
              )}

              {/* Approval threshold info */}
              {(activeAction === 'issue' || activeAction === 'consume') &&
               (confirmationThresholds?.stock_out || settings.stock_out_approval_threshold) && (
                <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/50 p-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Operations exceeding {confirmationThresholds?.stock_out || settings.stock_out_approval_threshold} units require admin approval
                  </span>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="location">Storage Location</Label>
                <Select
                  value={formData.location_id}
                  onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({getLocationTypeDisplay(loc)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(activeAction === 'issue' || activeAction === 'consume') && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="recipient">Recipient / Used By</Label>
                    <Input
                      id="recipient"
                      value={formData.recipient}
                      onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                      placeholder="Who is using this item?"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="project_tag">Project Tag</Label>
                    <Input
                      id="project_tag"
                      value={formData.project_tag}
                      onChange={(e) => setFormData({ ...formData, project_tag: e.target.value })}
                      placeholder="e.g., LAB-001"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="notes">
                  Reason / Notes {isReasonRequired && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={
                    activeAction === 'issue' ? 'Purpose of issue...' :
                    activeAction === 'return' ? 'Reason for return...' :
                    activeAction === 'adjust' ? 'Reason for adjustment (e.g., stocktake correction)...' :
                    'Purpose of consumption...'
                  }
                  rows={3}
                  required={isReasonRequired}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitting}
                variant={actionConfig.variant}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {(() => {
                  const Icon = actionConfig.icon;
                  return <Icon className="mr-2 h-4 w-4" />;
                })()}
                Record {actionConfig.label}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Selected Item Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selected Item</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedItem ? (
              <div className="space-y-4">
                {selectedItem.image_url ? (
                  <img 
                    src={selectedItem.image_url} 
                    alt={selectedItem.name}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-12 w-12 text-primary" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{selectedItem.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{selectedItem.code}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current Stock</p>
                    <div className="mt-1">
                      <NegativeStockIndicator
                        currentStock={selectedItem.current_stock}
                        minimumStock={selectedItem.minimum_stock}
                        lastTransaction={lastTransaction}
                        showBadge={false}
                        className="text-2xl"
                      />
                      <span className="text-sm text-muted-foreground ml-1">
                        {selectedItem.unit}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Minimum</p>
                    <p className="text-2xl font-bold">
                      {selectedItem.minimum_stock}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {selectedItem.unit}
                      </span>
                    </p>
                  </div>
                </div>
                {selectedItem.current_stock <= selectedItem.minimum_stock && selectedItem.current_stock >= 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    Below minimum stock level
                  </div>
                )}
                {formData.quantity > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">After {activeAction}:</p>
                    <div className="mt-1">
                      <NegativeStockIndicator
                        currentStock={getBalanceAfter()}
                        minimumStock={selectedItem.minimum_stock}
                        showBadge={true}
                        className="text-xl"
                      />
                      <span className="text-sm text-muted-foreground ml-1">
                        {selectedItem.unit}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="mx-auto h-12 w-12 opacity-50" />
                <p className="mt-2">Select an item to see details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval Request Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approval Required</DialogTitle>
            <DialogDescription>
              This {activeAction} of {pendingTransaction?.quantity} units exceeds the approval threshold of {pendingTransaction?.threshold} units.
              Please provide a reason for this request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="approval-reason">Reason for Request</Label>
              <Textarea
                id="approval-reason"
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="Explain why you need this quantity..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApprovalDialogOpen(false);
                setPendingTransaction(null);
                setApprovalReason('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={submitApprovalRequest} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
