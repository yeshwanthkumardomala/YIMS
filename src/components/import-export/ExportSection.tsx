import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { toCSV, downloadCSV } from '@/lib/csvUtils';

type ExportType = 'items' | 'locations' | 'stock_transactions';

export function ExportSection() {
  const [exporting, setExporting] = useState<ExportType | null>(null);

  async function handleExport(type: ExportType) {
    setExporting(type);
    try {
      switch (type) {
        case 'items':
          await exportItems();
          break;
        case 'locations':
          await exportLocations();
          break;
        case 'stock_transactions':
          await exportStockTransactions();
          break;
      }
      toast.success(`${type.replace('_', ' ')} exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export ${type.replace('_', ' ')}`);
    } finally {
      setExporting(null);
    }
  }

  async function exportItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*, category:categories(name), location:locations(name)')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    const csvData = (data || []).map((item) => ({
      code: item.code,
      name: item.name,
      description: item.description || '',
      category_name: (item.category as { name: string } | null)?.name || '',
      location_name: (item.location as { name: string } | null)?.name || '',
      current_stock: item.current_stock,
      minimum_stock: item.minimum_stock,
      unit: item.unit,
    }));

    const csv = toCSV(csvData, [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'category_name', label: 'Category' },
      { key: 'location_name', label: 'Location' },
      { key: 'current_stock', label: 'Current Stock' },
      { key: 'minimum_stock', label: 'Minimum Stock' },
      { key: 'unit', label: 'Unit' },
    ]);

    downloadCSV(csv, `yims-items-${new Date().toISOString().split('T')[0]}.csv`);
  }

  async function exportLocations() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('location_type')
      .order('name');

    if (error) throw error;

    // Build parent name map
    const locationMap = new Map((data || []).map((l) => [l.id, l.name]));

    const csvData = (data || []).map((loc) => ({
      code: loc.code,
      name: loc.name,
      location_type: loc.location_type,
      parent_name: loc.parent_id ? locationMap.get(loc.parent_id) || '' : '',
      description: loc.description || '',
    }));

    const csv = toCSV(csvData, [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'location_type', label: 'Type' },
      { key: 'parent_name', label: 'Parent Location' },
      { key: 'description', label: 'Description' },
    ]);

    downloadCSV(csv, `yims-locations-${new Date().toISOString().split('T')[0]}.csv`);
  }

  async function exportStockTransactions() {
    const { data, error } = await supabase
      .from('stock_transactions')
      .select('*, item:items(code, name)')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const csvData = (data || []).map((tx) => ({
      created_at: new Date(tx.created_at).toLocaleString(),
      item_code: (tx.item as { code: string; name: string } | null)?.code || '',
      item_name: (tx.item as { code: string; name: string } | null)?.name || '',
      transaction_type: tx.transaction_type,
      quantity: tx.quantity,
      balance_before: tx.balance_before,
      balance_after: tx.balance_after,
      recipient: tx.recipient || '',
      notes: tx.notes || '',
    }));

    const csv = toCSV(csvData, [
      { key: 'created_at', label: 'Date' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_name', label: 'Item Name' },
      { key: 'transaction_type', label: 'Type' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'balance_before', label: 'Balance Before' },
      { key: 'balance_after', label: 'Balance After' },
      { key: 'recipient', label: 'Recipient' },
      { key: 'notes', label: 'Notes' },
    ]);

    downloadCSV(csv, `yims-transactions-${new Date().toISOString().split('T')[0]}.csv`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Data
        </CardTitle>
        <CardDescription>Download your inventory data as CSV files</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => handleExport('items')}
            disabled={exporting !== null}
          >
            {exporting === 'items' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Download className="h-6 w-6" />
            )}
            <span className="font-medium">Export Items</span>
            <span className="text-xs text-muted-foreground">All inventory items</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => handleExport('locations')}
            disabled={exporting !== null}
          >
            {exporting === 'locations' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Download className="h-6 w-6" />
            )}
            <span className="font-medium">Export Locations</span>
            <span className="text-xs text-muted-foreground">Storage locations</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => handleExport('stock_transactions')}
            disabled={exporting !== null}
          >
            {exporting === 'stock_transactions' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Download className="h-6 w-6" />
            )}
            <span className="font-medium">Export Transactions</span>
            <span className="text-xs text-muted-foreground">Stock movements</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
