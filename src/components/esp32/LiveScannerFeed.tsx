import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Radio, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ScanLogEntry {
  id: string;
  code_scanned: string;
  code_type: string | null;
  action_taken: string | null;
  created_at: string;
  item_id: string | null;
  location_id: string | null;
}

export function LiveScannerFeed() {
  const { data: scans, isLoading } = useQuery({
    queryKey: ['esp32-live-scans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scan_logs')
        .select('*')
        .like('action_taken', 'esp32_scan:%')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ScanLogEntry[];
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const getDeviceId = (actionTaken: string | null): string => {
    if (!actionTaken) return 'unknown';
    const parts = actionTaken.split(':');
    return parts[1] || 'unknown';
  };

  const getScanStatus = (scan: ScanLogEntry): 'success' | 'warning' | 'error' => {
    if (scan.action_taken?.includes('invalid')) return 'error';
    if (!scan.code_type || scan.code_type === 'unknown') return 'error';
    // If item/location was found
    if (scan.item_id || scan.location_id) return 'success';
    // Valid code type but no item/location found
    return 'warning';
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadgeVariant = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
    }
  };

  const formatCodeType = (codeType: string | null): string => {
    if (!codeType) return 'Unknown';
    return codeType.charAt(0).toUpperCase() + codeType.slice(1);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Live Scanner Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
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
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Live Scanner Feed
          </CardTitle>
          <Badge variant="outline" className="animate-pulse">
            Auto-refresh: 10s
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {!scans || scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Radio className="h-12 w-12 mb-4 opacity-50" />
              <p>No ESP32 scans yet</p>
              <p className="text-sm">Scans will appear here in real-time</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scans.map((scan) => {
                const status = getScanStatus(scan);
                const deviceId = getDeviceId(scan.action_taken);
                const timeAgo = formatDistanceToNow(new Date(scan.created_at), { addSuffix: true });

                return (
                  <div
                    key={scan.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    {getStatusIcon(status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{deviceId}</span>
                        <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                          {formatCodeType(scan.code_type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {scan.code_scanned}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
