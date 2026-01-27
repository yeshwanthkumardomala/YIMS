import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  MapPin,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  QrCode,
  TrendingUp,
  Clock,
  BarChart3,
} from 'lucide-react';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { QuickStartWizard } from '@/components/onboarding/QuickStartWizard';
import { useQuickStartWizard } from '@/hooks/useQuickStartWizard';
import type { DashboardStats, StockTransaction } from '@/types/database';
import { subDays } from 'date-fns';

export default function Dashboard() {
  const { profile, role, canManageInventory } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<StockTransaction[]>([]);
  const [chartTransactions, setChartTransactions] = useState<{ id: string; transaction_type: string; quantity: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  
  // Quick-start wizard
  const { shouldShowWizard, isLoading: wizardLoading, markWizardComplete } = useQuickStartWizard();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Show wizard when data loads and user is first-time
  useEffect(() => {
    if (!wizardLoading && shouldShowWizard) {
      setWizardOpen(true);
    }
  }, [wizardLoading, shouldShowWizard]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch item count
        const { count: itemCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // For now, count items with stock < minimum_stock
        const { data: allItems } = await supabase
          .from('items')
          .select('current_stock, minimum_stock')
          .eq('is_active', true);
        
        const lowStockCount = allItems?.filter(item => item.current_stock < item.minimum_stock).length || 0;

        // Fetch location count
        const { count: locationCount } = await supabase
          .from('locations')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch recent transactions count (last 24h)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { count: transactionCount } = await supabase
          .from('stock_transactions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterday.toISOString());

        setStats({
          totalItems: itemCount || 0,
          lowStockItems: lowStockCount,
          totalLocations: locationCount || 0,
          recentTransactions: transactionCount || 0,
        });

        // Fetch recent transactions for display
        const { data: transactions } = await supabase
          .from('stock_transactions')
          .select(`
            *,
            item:items(name, code)
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentTransactions((transactions as unknown as StockTransaction[]) || []);

        // Fetch transactions for charts (last 14 days)
        const twoWeeksAgo = subDays(new Date(), 14);
        const { data: chartData } = await supabase
          .from('stock_transactions')
          .select('id, transaction_type, quantity, created_at')
          .gte('created_at', twoWeeksAgo.toISOString())
          .order('created_at', { ascending: true });

        setChartTransactions(chartData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

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

  return (
    <>
      {/* Quick Start Wizard for first-time users */}
      <QuickStartWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={markWizardComplete}
      />
      
      <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {profile?.full_name || profile?.username}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your inventory today.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/stock">
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Stock In
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/stock">
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            Stock Out
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/scan">
            <QrCode className="mr-2 h-4 w-4" />
            Scan Code
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/esp32-integration">
            <QrCode className="mr-2 h-4 w-4" />
            ESP32 Scanner
          </Link>
        </Button>
        <Button
          variant="ghost"
          onClick={() => setShowCharts(!showCharts)}
          className="ml-auto"
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          {showCharts ? 'Hide Charts' : 'Show Charts'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalItems || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Active inventory items</p>
          </CardContent>
        </Card>

        <Card className={stats?.lowStockItems && stats.lowStockItems > 0 ? 'border-warning' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-warning">{stats?.lowStockItems || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Items below minimum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalLocations || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Storage locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.recentTransactions || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Transactions (24h)</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {showCharts && (
        <DashboardCharts transactions={chartTransactions} loading={loading} />
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest stock movements in your inventory</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm">Start by adding some items to your inventory</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {getTransactionIcon(transaction.transaction_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {(transaction as unknown as { item?: { name: string } }).item?.name || 'Unknown Item'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {transaction.quantity > 0 ? '+' : ''}{transaction.quantity} units
                    </p>
                  </div>
                  <div className="text-right">
                    {getTransactionBadge(transaction.transaction_type)}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentTransactions.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Button asChild variant="outline" className="w-full">
                <Link to="/history">View All Transactions</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
