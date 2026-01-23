import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/filters/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Package, TrendingUp, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import type { DateRange, Item, StockTransaction, Category, Location } from '@/types/database';

type ReportType = 'inventory' | 'movements' | 'activity';

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('inventory');
  const [dateRange, setDateRange] = useState<DateRange>({ from: subDays(new Date(), 30), to: new Date() });
  const [groupBy, setGroupBy] = useState<'category' | 'location' | 'none'>('none');
  const [generating, setGenerating] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [itemsRes, categoriesRes, locationsRes] = await Promise.all([
      supabase.from('items').select('*, category:categories(*), location:locations(*)').eq('is_active', true),
      supabase.from('categories').select('*').eq('is_active', true),
      supabase.from('locations').select('*').eq('is_active', true),
    ]);

    if (itemsRes.data) setItems(itemsRes.data as unknown as Item[]);
    if (categoriesRes.data) setCategories(categoriesRes.data as unknown as Category[]);
    if (locationsRes.data) setLocations(locationsRes.data as unknown as Location[]);
  }

  async function fetchTransactions() {
    const query = supabase
      .from('stock_transactions')
      .select('*, item:items(name, code), performer:profiles(username)')
      .order('created_at', { ascending: false });

    if (dateRange.from) query.gte('created_at', dateRange.from.toISOString());
    if (dateRange.to) query.lte('created_at', dateRange.to.toISOString());

    const { data } = await query;
    return (data || []) as unknown as StockTransaction[];
  }

  function generateCSV(data: Record<string, unknown>[], filename: string) {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function generateReport() {
    setGenerating(true);
    try {
      switch (reportType) {
        case 'inventory': {
          const data = items.map(item => ({
            Code: item.code,
            Name: item.name,
            Category: item.category?.name || 'Uncategorized',
            Location: item.location?.name || 'No Location',
            'Current Stock': item.current_stock,
            'Minimum Stock': item.minimum_stock,
            Unit: item.unit,
            Status: item.current_stock === 0 ? 'Out of Stock' : item.current_stock < item.minimum_stock ? 'Low Stock' : 'In Stock',
          }));

          if (groupBy !== 'none') {
            data.sort((a, b) => (groupBy === 'category' ? a.Category : a.Location).localeCompare(groupBy === 'category' ? b.Category : b.Location));
          }

          generateCSV(data, 'inventory_report');
          toast.success('Inventory report downloaded');
          break;
        }

        case 'movements': {
          const txns = await fetchTransactions();
          const data = txns.map(t => ({
            Date: format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
            Item: (t as any).item?.name || 'Unknown',
            Code: (t as any).item?.code || '',
            Type: t.transaction_type.replace('_', ' ').toUpperCase(),
            Quantity: t.quantity,
            'Balance Before': t.balance_before,
            'Balance After': t.balance_after,
            User: (t as any).performer?.username || 'Unknown',
            Notes: t.notes || '',
          }));

          generateCSV(data, 'movement_report');
          toast.success('Movement report downloaded');
          break;
        }

        case 'activity': {
          const txns = await fetchTransactions();
          const userActivity: Record<string, { username: string; stockIn: number; stockOut: number; adjustments: number; total: number }> = {};

          txns.forEach(t => {
            const username = (t as any).performer?.username || 'Unknown';
            if (!userActivity[username]) {
              userActivity[username] = { username, stockIn: 0, stockOut: 0, adjustments: 0, total: 0 };
            }
            userActivity[username].total++;
            if (t.transaction_type === 'stock_in') userActivity[username].stockIn++;
            else if (t.transaction_type === 'stock_out') userActivity[username].stockOut++;
            else userActivity[username].adjustments++;
          });

          const data = Object.values(userActivity).map(u => ({
            User: u.username,
            'Stock In': u.stockIn,
            'Stock Out': u.stockOut,
            Adjustments: u.adjustments,
            'Total Transactions': u.total,
          }));

          generateCSV(data, 'activity_report');
          toast.success('Activity report downloaded');
          break;
        }
      }
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  const reportOptions = [
    { value: 'inventory', label: 'Inventory Valuation', icon: Package, description: 'Current stock levels by item, category, or location' },
    { value: 'movements', label: 'Movement Summary', icon: TrendingUp, description: 'Stock transactions within a date range' },
    { value: 'activity', label: 'User Activity', icon: Users, description: 'Transaction counts per user' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Generate and download inventory reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reportOptions.map((opt) => (
          <Card
            key={opt.value}
            className={`cursor-pointer transition-colors ${reportType === opt.value ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
            onClick={() => setReportType(opt.value as ReportType)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{opt.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Options</CardTitle>
          <CardDescription>Configure your report parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {reportType !== 'inventory' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}

            {reportType === 'inventory' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Group By</label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={generateReport} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download CSV Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
