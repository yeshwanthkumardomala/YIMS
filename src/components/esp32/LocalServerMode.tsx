import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wifi,
  WifiOff,
  Server,
  Smartphone,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  HardDrive,
  Upload,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  getLocalServerConfig,
  setLocalServerConfig,
  getPendingScans,
  getUnsyncedCount,
  clearSyncedScans,
  isElectron,
  formatServerUrl,
  type LocalServerConfig,
  type PendingScan,
} from '@/lib/localScanServer';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PROJECT_ID = 'cejaafrdxajcjyutettr';

export function LocalServerMode() {
  const [config, setConfig] = useState<LocalServerConfig>(getLocalServerConfig());
  const [localIp, setLocalIp] = useState<string>('');
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending scans
  useEffect(() => {
    const loadPendingScans = () => {
      setPendingScans(getPendingScans());
      setUnsyncedCount(getUnsyncedCount());
    };
    
    loadPendingScans();
    const interval = setInterval(loadPendingScans, 5000);
    return () => clearInterval(interval);
  }, []);

  // Try to detect local IP (limited in browser)
  useEffect(() => {
    // In a real Electron app, we'd use Node.js to get the actual IP
    // For now, show a placeholder that users should replace
    setLocalIp('192.168.1.XXX');
  }, []);

  const handleToggle = (enabled: boolean) => {
    const newConfig = { ...config, enabled };
    setConfig(newConfig);
    setLocalServerConfig(newConfig);
    
    if (enabled) {
      toast.success('Local Server Mode enabled. Update your ESP32 code with the server URL below.');
    } else {
      toast.info('Local Server Mode disabled. ESP32 will use cloud mode.');
    }
  };

  const handlePortChange = (port: string) => {
    const portNum = parseInt(port, 10);
    if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
      const newConfig = { ...config, port: portNum };
      setConfig(newConfig);
      setLocalServerConfig(newConfig);
    }
  };

  const copyServerUrl = async () => {
    const url = formatServerUrl(localIp, config.port);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Server URL copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const syncToCloud = async () => {
    if (!isOnline) {
      toast.error('No internet connection. Sync when online.');
      return;
    }
    
    const unsynced = pendingScans.filter(s => !s.synced);
    if (unsynced.length === 0) {
      toast.info('No pending scans to sync.');
      return;
    }
    
    setIsSyncing(true);
    let successCount = 0;
    
    try {
      for (const scan of unsynced) {
        // Log the scan to the database
        const { error } = await supabase.from('scan_logs').insert({
          code_scanned: scan.code,
          code_type: scan.code.includes(':ITEM:') ? 'item' : 'location',
          action_taken: `esp32_scan:${scan.device_id}:offline_sync`,
          created_at: scan.timestamp,
        });
        
        if (!error) {
          successCount++;
        }
      }
      
      if (successCount > 0) {
        clearSyncedScans();
        setPendingScans(getPendingScans());
        setUnsyncedCount(getUnsyncedCount());
        toast.success(`Synced ${successCount} scans to cloud.`);
      }
    } catch (error) {
      toast.error('Sync failed. Will retry later.');
    } finally {
      setIsSyncing(false);
    }
  };

  const serverUrl = formatServerUrl(localIp, config.port);
  const cloudUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/esp32-scan`;

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Mode Configuration
          </CardTitle>
          <CardDescription>
            Choose between cloud mode (requires internet) or local mode (works offline)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {config.enabled ? (
                <HardDrive className="h-6 w-6 text-primary" />
              ) : (
                <Cloud className="h-6 w-6 text-primary" />
              )}
              <div>
                <Label className="text-base font-medium">
                  {config.enabled ? 'Local Mode' : 'Cloud Mode'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {config.enabled 
                    ? 'ESP32 connects to this device on local network'
                    : 'ESP32 connects directly to cloud server'}
                </p>
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={handleToggle}
            />
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Badge variant="default" className="gap-1">
                <Wifi className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            {isElectron() && (
              <Badge variant="secondary">Electron Desktop</Badge>
            )}
          </div>

          {/* Server URL Display */}
          <div className="space-y-3">
            <Label>ESP32 Server URL</Label>
            <div className="flex gap-2">
              <Input
                value={config.enabled ? serverUrl : cloudUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={copyServerUrl}>
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Local Mode Settings */}
          {config.enabled && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="local-ip">Local IP Address</Label>
                  <Input
                    id="local-ip"
                    value={localIp}
                    onChange={(e) => setLocalIp(e.target.value)}
                    placeholder="192.168.1.100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Find using: ipconfig (Windows) or ifconfig (Mac/Linux)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={config.port}
                    onChange={(e) => handlePortChange(e.target.value)}
                    min={1}
                    max={65535}
                  />
                </div>
              </div>

              {/* QR Code for easy configuration */}
              <div className="flex flex-col items-center p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={serverUrl}
                  size={120}
                  level="M"
                  includeMargin
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Scan to copy server URL
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Sync */}
      {config.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Pending Sync
              </span>
              {unsyncedCount > 0 && (
                <Badge variant="secondary">{unsyncedCount} pending</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Offline scans waiting to be synced to cloud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={syncToCloud} 
              disabled={!isOnline || isSyncing || unsyncedCount === 0}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-4 w-4" />
                  Sync {unsyncedCount} Scans to Cloud
                </>
              )}
            </Button>

            {pendingScans.length > 0 && (
              <ScrollArea className="h-[200px] rounded border">
                <div className="p-3 space-y-2">
                  {pendingScans.slice(-10).reverse().map((scan) => (
                    <div
                      key={scan.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                        <code className="font-mono text-xs">{scan.code}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(scan.timestamp).toLocaleTimeString()}
                        </span>
                        {scan.synced ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Arduino Code Update Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Arduino Code Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Update Your ESP32 Code</AlertTitle>
            <AlertDescription className="mt-2">
              {config.enabled ? (
                <div className="space-y-2">
                  <p>To use Local Mode, update these values in your Arduino code:</p>
                  <pre className="mt-2 p-3 rounded bg-muted font-mono text-xs overflow-x-auto">
{`// Set to true for local mode
#define USE_LOCAL_SERVER true

// Your local server details
const char* LOCAL_SERVER_IP = "${localIp}";
const int LOCAL_SERVER_PORT = ${config.port};`}
                  </pre>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>Cloud Mode is active. Use this in your Arduino code:</p>
                  <pre className="mt-2 p-3 rounded bg-muted font-mono text-xs overflow-x-auto">
{`// Set to false for cloud mode
#define USE_LOCAL_SERVER false

// Cloud server is pre-configured`}
                  </pre>
                </div>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Mode Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Mode Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${!config.enabled ? 'border-primary bg-primary/5' : 'border-muted'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Cloud className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Cloud Mode</h4>
                {!config.enabled && <Badge>Active</Badge>}
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Real-time cloud database access
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Automatic scan logging
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Requires internet connection
                </li>
              </ul>
            </div>

            <div className={`p-4 rounded-lg border-2 ${config.enabled ? 'border-primary bg-primary/5' : 'border-muted'}`}>
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Local Mode</h4>
                {config.enabled && <Badge>Active</Badge>}
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Works without internet
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Uses local IndexedDB
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Requires sync when online
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
