import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays, parseISO, startOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, BarChart3, PieChartIcon } from 'lucide-react';

interface Transaction {
  id: string;
  transaction_type: string;
  quantity: number;
  created_at: string;
}

interface DashboardChartsProps {
  transactions: Transaction[];
  loading: boolean;
}

const COLORS = {
  stockIn: 'hsl(142, 76%, 36%)',  // green
  stockOut: 'hsl(0, 84%, 60%)',    // red
  adjustment: 'hsl(220, 14%, 46%)', // gray
};

const PIE_COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(45, 93%, 47%)', 'hsl(280, 65%, 60%)'];

export function DashboardCharts({ transactions, loading }: DashboardChartsProps) {
  // Process transactions for the last 14 days
  const dailyData = useMemo(() => {
    const days = 14;
    const data: { date: string; label: string; stockIn: number; stockOut: number; adjustment: number; net: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const dateStr = format(date, 'yyyy-MM-dd');
      const label = format(date, 'MMM dd');
      
      const dayTransactions = transactions.filter((t) => {
        const tDate = format(parseISO(t.created_at), 'yyyy-MM-dd');
        return tDate === dateStr;
      });
      
      const stockIn = dayTransactions
        .filter((t) => t.transaction_type === 'stock_in')
        .reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      
      const stockOut = dayTransactions
        .filter((t) => t.transaction_type === 'stock_out')
        .reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      
      const adjustment = dayTransactions
        .filter((t) => t.transaction_type === 'adjustment')
        .reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      
      data.push({
        date: dateStr,
        label,
        stockIn,
        stockOut,
        adjustment,
        net: stockIn - stockOut,
      });
    }
    
    return data;
  }, [transactions]);

  // Transaction type distribution
  const typeDistribution = useMemo(() => {
    const counts = { stockIn: 0, stockOut: 0, adjustment: 0 };
    
    transactions.forEach((t) => {
      if (t.transaction_type === 'stock_in') counts.stockIn++;
      else if (t.transaction_type === 'stock_out') counts.stockOut++;
      else counts.adjustment++;
    });
    
    return [
      { name: 'Stock In', value: counts.stockIn, color: COLORS.stockIn },
      { name: 'Stock Out', value: counts.stockOut, color: COLORS.stockOut },
      { name: 'Adjustment', value: counts.adjustment, color: COLORS.adjustment },
    ].filter((d) => d.value > 0);
  }, [transactions]);

  // Cumulative net stock change
  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return dailyData.map((day) => {
      cumulative += day.net;
      return { ...day, cumulative };
    });
  }, [dailyData]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasData = transactions.length > 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Transaction Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Transaction Volume
          </CardTitle>
          <CardDescription>Daily stock movements over the last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Bar dataKey="stockIn" name="Stock In" fill={COLORS.stockIn} radius={[4, 4, 0, 0]} />
                <Bar dataKey="stockOut" name="Stock Out" fill={COLORS.stockOut} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No transaction data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Net Stock Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Net Stock Trend
          </CardTitle>
          <CardDescription>Cumulative inventory change over time</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Net Change"
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2}
                  fill="url(#colorNet)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No trend data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Transaction Distribution
          </CardTitle>
          <CardDescription>Breakdown by transaction type</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData && typeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No distribution data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Daily Net Change
          </CardTitle>
          <CardDescription>Daily stock balance changes</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar 
                  dataKey="net" 
                  name="Net Change"
                  radius={[4, 4, 0, 0]}
                >
                  {dailyData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.net >= 0 ? COLORS.stockIn : COLORS.stockOut} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
