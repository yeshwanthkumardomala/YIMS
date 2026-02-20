import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  History as HistoryIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExportDropdown } from '@/components/ExportDropdown';
import { toCSV, downloadCSV } from '@/lib/csvUtils';
import { downloadExcelSingleSheet } from '@/lib/excelUtils';
import type { StockTransaction } from '@/types/database';

interface TransactionWithJoins extends Omit<StockTransaction, 'item' | 'performer'> {
  item?: { name: string; code: string } | null;
  performer?: { username: string } | null;
}

const HISTORY_CSV_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'item_code', label: 'Item Code' },
  { key: 'item_name', label: 'Item Name' },
  { key: 'transaction_type', label: 'Type' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'balance_before', label: 'Before' },
  { key: 'balance_after', label: 'After' },
  { key: 'performer', label: 'User' },
  { key: 'notes', label: 'Notes' },
] as const;

export default function History() {
  const [transactions, setTransactions] = useState<TransactionWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select(`
          *,
          item:items(name, code),
          performer:profiles!performed_by(username)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions((data as unknown as TransactionWithJoins[]) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'stock_in':
        return <ArrowDownToLine className="h-4 w-4 text-success" />;
      case 'stock_out':
        return <ArrowUpFromLine className="h-4 w-4 text-destructive" />;
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'stock_in':
        return <Badge className="bg-success/10 text-success border-success/20">Stock In</Badge>;
      case 'stock_out':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Stock Out</Badge>;
      default:
        return <Badge variant="secondary">Adjustment</Badge>;
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.item?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.item?.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.performer?.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;
    return matchesSearch && matchesType;
  });

  function formatTransactionsForExport(data: TransactionWithJoins[]) {
    return data.map((t) => ({
      date: new Date(t.created_at).toLocaleDateString(),
      time: new Date(t.created_at).toLocaleTimeString(),
      item_code: t.item?.code || '',
      item_name: t.item?.name || '',
      transaction_type: t.transaction_type,
      quantity: t.quantity,
      balance_before: t.balance_before,
      balance_after: t.balance_after,
      performer: t.performer?.username || '',
      notes: t.notes || '',
    }));
  }

  function exportAllCSV() {
    const formatted = formatTransactionsForExport(transactions);
    const csv = toCSV(formatted, HISTORY_CSV_COLUMNS);
    downloadCSV(csv, `transactions-all-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Exported all transactions to CSV');
  }

  function exportFilteredCSV() {
    const formatted = formatTransactionsForExport(filteredTransactions);
    const csv = toCSV(formatted, HISTORY_CSV_COLUMNS);
    downloadCSV(csv, `transactions-filtered-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Exported filtered transactions to CSV');
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const formatted = formatTransactionsForExport(transactions);
      await downloadExcelSingleSheet(formatted, HISTORY_CSV_COLUMNS, `transactions-${new Date().toISOString().split('T')[0]}.xlsx`, 'Transactions');
      toast.success('Exported transactions to Excel');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export Excel file');
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground">View all stock movements and changes</p>
        </div>
        <ExportDropdown
          onExportCSV={exportAllCSV}
          onExportFiltered={exportFilteredCSV}
          onExportExcel={exportExcel}
          onPrint={handlePrint}
          loading={exporting}
          filteredCount={filteredTransactions.length}
          totalCount={transactions.length}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by item, code, user, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="stock_in">Stock In</SelectItem>
                <SelectItem value="stock_out">Stock Out</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" />
            Transactions
            <Badge variant="secondary" className="ml-2">
              {filteredTransactions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <HistoryIcon className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No transactions found</h3>
              <p className="text-muted-foreground">
                {searchQuery || typeFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Stock movements will appear here'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(transaction.created_at).toLocaleDateString()}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{transaction.item?.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {transaction.item?.code}
                      </div>
                    </TableCell>
                    <TableCell>{getTransactionBadge(transaction.transaction_type)}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span
                        className={
                          transaction.transaction_type === 'stock_in'
                            ? 'text-success'
                            : 'text-destructive'
                        }
                      >
                        {transaction.transaction_type === 'stock_in' ? '+' : '-'}
                        {transaction.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{transaction.balance_before}</TableCell>
                    <TableCell className="text-right font-medium">
                      {transaction.balance_after}
                    </TableCell>
                    <TableCell>{transaction.performer?.username || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {transaction.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
