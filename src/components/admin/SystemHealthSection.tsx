import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Database,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Trash2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useSafeMode } from '@/contexts/SafeModeContext';
import { getStorageInfo, getRecordCounts } from '@/lib/offlineDataUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HealthStatus {
  database: 'healthy' | 'warning' | 'error' | 'checking';
  storage: 'healthy' | 'warning' | 'error' | 'checking';
  connection: 'healthy' | 'warning' | 'error' | 'checking';
}

export function SystemHealthSection() {
  const { isSafeMode, error, errorHistory, exitSafeMode, clearErrorHistory } = useSafeMode();
  const [health, setHealth] = useState<HealthStatus>({
    database: 'checking',
    storage: 'checking',
    connection: 'checking',
  });
  const [storageInfo, setStorageInfo] = useState<{
    used: string;
    available: string;
    percentage: number;
  } | null>(null);
  const [recordCounts, setRecordCounts] = useState<{
    items: number;
    categories: number;
    locations: number;
    stockTransactions: number;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const runHealthCheck = async () => {
    setIsChecking(true);
    setHealth({
      database: 'checking',
      storage: 'checking',
      connection: 'checking',
    });

    try {
      // Check database connection
      const { error: dbError } = await supabase.from('items').select('id').limit(1);
      setHealth((prev) => ({
        ...prev,
        database: dbError ? 'error' : 'healthy',
      }));

      // Check storage
      const storage = await getStorageInfo();
      const counts = await getRecordCounts();
      setStorageInfo(storage);
      setRecordCounts(counts);

      if (storage) {
        setHealth((prev) => ({
          ...prev,
          storage: storage.percentage > 90 ? 'error' : storage.percentage > 70 ? 'warning' : 'healthy',
        }));
      } else {
        setHealth((prev) => ({ ...prev, storage: 'warning' }));
      }

      // Check network connection
      setHealth((prev) => ({
        ...prev,
        connection: navigator.onLine ? 'healthy' : 'warning',
      }));

      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({
        database: 'error',
        storage: 'error',
        connection: 'error',
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error' | 'checking') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: 'healthy' | 'warning' | 'error' | 'checking') => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">Healthy</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'checking':
        return <Badge variant="outline">Checking...</Badge>;
    }
  };

  const overallHealth =
    health.database === 'error' || health.storage === 'error' || health.connection === 'error'
      ? 'error'
      : health.database === 'warning' || health.storage === 'warning' || health.connection === 'warning'
      ? 'warning'
      : 'healthy';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
        <CardDescription>Monitor system status and error history</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Safe Mode Status */}
        {isSafeMode && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">Safe Mode Active</span>
              </div>
              <Button size="sm" variant="outline" onClick={exitSafeMode}>
                Exit Safe Mode
              </Button>
            </div>
            {error && (
              <div className="text-sm">
                <span className="text-muted-foreground">Last error: </span>
                <span>{error.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(overallHealth)}
            <div>
              <p className="font-medium">Overall Status</p>
              <p className="text-sm text-muted-foreground">
                Last checked: {lastCheck ? lastCheck.toLocaleTimeString() : 'Never'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(overallHealth)}
            <Button size="sm" variant="outline" onClick={runHealthCheck} disabled={isChecking}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              Check
            </Button>
          </div>
        </div>

        <Separator />

        {/* Individual Checks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Database Connection</span>
            </div>
            {getStatusBadge(health.database)}
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Local Storage</span>
            </div>
            <div className="flex items-center gap-2">
              {storageInfo && (
                <span className="text-xs text-muted-foreground">{storageInfo.used}</span>
              )}
              {getStatusBadge(health.storage)}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Network Connection</span>
            </div>
            {getStatusBadge(health.connection)}
          </div>
        </div>

        {/* Storage Details */}
        {storageInfo && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Storage Usage</span>
                <span className="text-muted-foreground">{storageInfo.percentage}%</span>
              </div>
              <Progress 
                value={storageInfo.percentage} 
                className={`h-2 ${storageInfo.percentage > 90 ? '[&>div]:bg-destructive' : storageInfo.percentage > 70 ? '[&>div]:bg-amber-500' : ''}`}
              />
              <p className="text-xs text-muted-foreground">
                {storageInfo.used} used of available storage
              </p>
            </div>
          </>
        )}

        {/* Error History */}
        {errorHistory.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Error History</Label>
                <Button size="sm" variant="ghost" onClick={clearErrorHistory}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>

              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {errorHistory.slice(0, 10).map((err, index) => (
                  <div key={index} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant={err.recoverable ? 'warning' : 'destructive'}>
                        {err.code}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {err.timestamp.toLocaleString()}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{err.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
