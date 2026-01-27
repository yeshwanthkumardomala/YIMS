import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ScanLog {
  id: string;
  code_scanned: string;
  code_type: string | null;
  action_taken: string | null;
  created_at: string;
}

export function RecentESP32Scans() {
  const [scans, setScans] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentScans() {
      try {
        const { data, error } = await supabase
          .from('scan_logs')
          .select('id, code_scanned, code_type, action_taken, created_at')
          .like('action_taken', 'esp32_scan:%')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setScans(data || []);
      } catch (error) {
        console.error('Error fetching ESP32 scans:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRecentScans();

    // Set up realtime subscription
    const channel = supabase
      .channel('esp32-scans-widget')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_logs',
        },
        (payload) => {
          const newScan = payload.new as ScanLog;
          if (newScan.action_taken?.startsWith('esp32_scan:')) {
            setScans((prev) => [newScan, ...prev].slice(0, 5));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getDeviceId = (actionTaken: string | null) => {
    if (!actionTaken) return 'unknown';
    const parts = actionTaken.split(':');
    return parts[1] || 'unknown';
  };

  const getScanStatus = (codeType: string | null, actionTaken: string | null) => {
    if (actionTaken?.includes('invalid')) {
      return { status: 'error', icon: XCircle, color: 'text-destructive' };
    }
    if (!codeType || codeType === 'unknown') {
      return { status: 'warning', icon: AlertTriangle, color: 'text-warning' };
    }
    return { status: 'success', icon: CheckCircle2, color: 'text-success' };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            ESP32 Scanner Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              ESP32 Scanner Activity
            </CardTitle>
            <CardDescription>Recent hardware scanner activity</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/esp32-integration">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {scans.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <Cpu className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No ESP32 scans yet</p>
            <p className="text-xs">Set up a scanner to see activity here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan) => {
              const { icon: StatusIcon, color } = getScanStatus(scan.code_type, scan.action_taken);
              const deviceId = getDeviceId(scan.action_taken);

              return (
                <div
                  key={scan.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <StatusIcon className={`h-4 w-4 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{scan.code_scanned}</p>
                    <p className="text-xs text-muted-foreground">
                      {deviceId} • {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {scan.code_type || 'unknown'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
