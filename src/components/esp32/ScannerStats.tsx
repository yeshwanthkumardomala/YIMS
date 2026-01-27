import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Activity, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';

interface ScanStats {
  totalScans: number;
  successRate: number;
  activeDevices: number;
  mostActiveDevice: string | null;
}

export function ScannerStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['esp32-scan-stats'],
    queryFn: async (): Promise<ScanStats> => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch ESP32 scans from last 7 days
      const { data: scans, error } = await supabase
        .from('scan_logs')
        .select('action_taken, code_type, created_at')
        .like('action_taken', 'esp32_scan:%')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      const scanList = scans || [];
      const totalScans = scanList.length;

      // Calculate success rate (has valid code_type that isn't 'unknown')
      const successfulScans = scanList.filter(
        (s) => s.code_type && s.code_type !== 'unknown' && !s.action_taken?.includes('invalid')
      ).length;
      const successRate = totalScans > 0 ? (successfulScans / totalScans) * 100 : 0;

      // Count unique devices
      const deviceSet = new Set<string>();
      const deviceCounts: Record<string, number> = {};

      scanList.forEach((scan) => {
        const deviceId = scan.action_taken?.split(':')[1] || 'unknown';
        deviceSet.add(deviceId);
        deviceCounts[deviceId] = (deviceCounts[deviceId] || 0) + 1;
      });

      // Find most active device
      let mostActiveDevice: string | null = null;
      let maxCount = 0;
      Object.entries(deviceCounts).forEach(([device, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostActiveDevice = device;
        }
      });

      return {
        totalScans,
        successRate,
        activeDevices: deviceSet.size,
        mostActiveDevice,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Scans (7d)',
      value: stats?.totalScans || 0,
      icon: Activity,
      color: 'text-primary',
    },
    {
      title: 'Success Rate',
      value: `${(stats?.successRate || 0).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      title: 'Active Devices',
      value: stats?.activeDevices || 0,
      icon: Cpu,
      color: 'text-blue-500',
    },
    {
      title: 'Most Active',
      value: stats?.mostActiveDevice || 'None',
      icon: AlertTriangle,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
