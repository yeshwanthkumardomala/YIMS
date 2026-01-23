import { useState, useEffect } from 'react';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Loader2, Package, Clock, Image as ImageIcon } from 'lucide-react';
import type { Item, Location } from '@/types/database';

interface RouterState {
  itemId?: string;
  action?: 'stock_in' | 'stock_out';
}

interface AppSettings {
  stock_out_approval_threshold?: number;
}

export default function Stock() {
  const { user } = useAuth();
  const routerLocation = useRouterLocation();
  const state = routerLocation.state as RouterState | null;
  
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock_in' | 'stock_out'>(state?.action || 'stock_in');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [pendingTransaction, setPendingTransaction] = useState<null | {
    item: Item;
    quantity: number;
    threshold: number;
  }>(null);
  const [settings, setSettings] = useState<AppSettings>({});

  const [formData, setFormData] = useState({
    item_id: state?.itemId || '',
    quantity: 1,
    location_id: '',
    notes: '',
    recipient: '',
  });

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

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
      }
    }
  }, [state?.itemId, items]);

  function handleItemChange(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    setSelectedItem(item || null);
    setFormData({ ...formData, item_id: itemId });
  }

  function resetForm() {
    setFormData({
      item_id: '',
      quantity: 1,
      location_id: '',
      notes: '',
      recipient: '',
    });
    setSelectedItem(null);
  }

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

    // Check if approval is required for large stock-outs
    const threshold = settings.stock_out_approval_threshold || 0;
    if (activeTab === 'stock_out' && threshold > 0 && formData.quantity > threshold) {
      setPendingTransaction({
        item: selectedItem,
        quantity: formData.quantity,
        threshold,
      });
      setApprovalDialogOpen(true);
      return;
    }

    // Check for negative stock warning
    if (activeTab === 'stock_out') {
      const newBalance = selectedItem.current_stock - formData.quantity;
      if (newBalance < 0) {
        const confirmed = confirm(
          `Warning: This will result in negative stock (${newBalance}). Are you sure you want to proceed?`
        );
        if (!confirmed) return;
      }
    }

    await processTransaction();
  }

  async function processTransaction() {
    if (!selectedItem || !user) return;

    setSubmitting(true);
    try {
      const balanceBefore = selectedItem.current_stock;
      const quantity = activeTab === 'stock_in' ? formData.quantity : -formData.quantity;
      const balanceAfter = balanceBefore + quantity;

      // Create transaction
      const { error: transactionError } = await supabase.from('stock_transactions').insert({
        item_id: formData.item_id,
        transaction_type: activeTab,
        quantity: Math.abs(formData.quantity),
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        location_id: formData.location_id || null,
        notes: formData.notes.trim() || null,
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

      toast.success(
        activeTab === 'stock_in'
          ? `Added ${formData.quantity} ${selectedItem.unit} to ${selectedItem.name}`
          : `Removed ${formData.quantity} ${selectedItem.unit} from ${selectedItem.name}`
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Operations</h1>
        <p className="text-muted-foreground">Record stock movements in your inventory</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stock Operation Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Record Transaction</CardTitle>
            <CardDescription>
              Add or remove items from your inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'stock_in' | 'stock_out')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stock_in" className="gap-2">
                  <ArrowDownToLine className="h-4 w-4" />
                  Stock In
                </TabsTrigger>
                <TabsTrigger value="stock_out" className="gap-2">
                  <ArrowUpFromLine className="h-4 w-4" />
                  Stock Out
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stock_in" className="mt-6">
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
                              {item.name} ({item.current_stock} {item.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
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
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Enter any notes (e.g., source, invoice number)"
                      rows={3}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Record Stock In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="stock_out" className="mt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="item-out">Item *</Label>
                      <Select value={formData.item_id} onValueChange={handleItemChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.current_stock} {item.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="quantity-out">Quantity *</Label>
                      <Input
                        id="quantity-out"
                        type="number"
                        min="1"
                        max={selectedItem?.current_stock || 0}
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  {selectedItem && formData.quantity > selectedItem.current_stock && (
                    <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span>
                        Warning: Quantity exceeds current stock ({selectedItem.current_stock}{' '}
                        {selectedItem.unit})
                      </span>
                    </div>
                  )}
                  {settings.stock_out_approval_threshold && settings.stock_out_approval_threshold > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/50 p-3 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Stock-outs exceeding {settings.stock_out_approval_threshold} units require admin approval
                      </span>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="recipient">Recipient / Used By</Label>
                    <Input
                      id="recipient"
                      value={formData.recipient}
                      onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                      placeholder="Who is using or receiving this item?"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes-out">Reason / Notes</Label>
                    <Textarea
                      id="notes-out"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Purpose of usage or withdrawal"
                      rows={3}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <ArrowUpFromLine className="mr-2 h-4 w-4" />
                    Record Stock Out
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
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
                    <p className="text-2xl font-bold">
                      {selectedItem.current_stock}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {selectedItem.unit}
                      </span>
                    </p>
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
                {selectedItem.current_stock < selectedItem.minimum_stock && (
                  <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    Below minimum stock level
                  </div>
                )}
                {formData.quantity > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">After transaction:</p>
                    <p className="text-xl font-bold">
                      {activeTab === 'stock_in'
                        ? selectedItem.current_stock + formData.quantity
                        : selectedItem.current_stock - formData.quantity}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {selectedItem.unit}
                      </span>
                    </p>
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
              This stock-out of {pendingTransaction?.quantity} units exceeds the approval threshold of {pendingTransaction?.threshold} units.
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
