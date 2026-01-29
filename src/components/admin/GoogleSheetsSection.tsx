import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FileSpreadsheet,
  Link2,
  Unlink,
  Upload,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ConnectionStatus {
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
}

interface ExportHistory {
  id: string;
  spreadsheet_name: string;
  spreadsheet_url: string;
  spreadsheet_id: string;
  exported_at: string;
  export_type: string;
  record_counts: {
    items?: number;
    locations?: number;
    transactions?: number;
    users?: number;
    systemLogs?: number;
  };
}

export function GoogleSheetsSection() {
  const { isAdmin } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'versioned' | 'overwrite'>('versioned');

  const checkConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-sheets-export', {
        body: { action: 'check_connection' },
      });

      if (error) throw error;
      setConnectionStatus(data);
    } catch (error) {
      console.error('Failed to check connection:', error);
      setConnectionStatus({ connected: false, email: null, expiresAt: null });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExportHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('google_sheets_exports')
        .select('*')
        .order('exported_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setExportHistory((data || []) as ExportHistory[]);
    } catch (error) {
      console.error('Failed to load export history:', error);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    loadExportHistory();
  }, [checkConnection, loadExportHistory]);

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && state === 'google_sheets_oauth') {
        setConnecting(true);
        try {
          const redirectUri = `${window.location.origin}${window.location.pathname}`;
          const { data, error } = await supabase.functions.invoke('google-sheets-export', {
            body: { action: 'exchange_code', code, redirectUri },
          });

          if (error) throw error;

          toast.success(`Connected to ${data.email}`);
          await checkConnection();

          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('OAuth callback error:', error);
          toast.error('Failed to connect Google account');
        } finally {
          setConnecting(false);
        }
      }
    };

    handleCallback();
  }, [checkConnection]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.functions.invoke('google-sheets-export', {
        body: { action: 'get_auth_url', redirectUri },
      });

      if (error) throw error;

      // Add state parameter for security
      const authUrl = new URL(data.authUrl);
      authUrl.searchParams.set('state', 'google_sheets_oauth');
      
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      toast.error('Failed to initiate Google connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { error } = await supabase.functions.invoke('google-sheets-export', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;

      toast.success('Google account disconnected');
      setConnectionStatus({ connected: false, email: null, expiresAt: null });
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect Google account');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setShowExportDialog(false);
    
    try {
      const lastExport = exportHistory[0];
      const existingSpreadsheetId = exportMode === 'overwrite' && lastExport
        ? lastExport.spreadsheet_id
        : undefined;

      const { data, error } = await supabase.functions.invoke('google-sheets-export', {
        body: { action: 'export', exportMode, existingSpreadsheetId },
      });

      if (error) throw error;

      toast.success(
        <div className="space-y-1">
          <p className="font-medium">Export complete!</p>
          <p className="text-sm text-muted-foreground">
            {data.recordCounts.items} items, {data.recordCounts.transactions} transactions
          </p>
          <a
            href={data.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline flex items-center gap-1"
          >
            Open Spreadsheet <ExternalLink className="h-3 w-3" />
          </a>
        </div>,
        { duration: 8000 }
      );

      await loadExportHistory();
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Google Sheets Export
        </CardTitle>
        <CardDescription>
          Connect your Google account to export inventory data to Google Sheets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : connectionStatus?.connected ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {loading
                    ? 'Checking connection...'
                    : connectionStatus?.connected
                    ? 'Connected'
                    : 'Not connected'}
                </p>
                {connectionStatus?.email && (
                  <p className="text-sm text-muted-foreground">{connectionStatus.email}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {connectionStatus?.connected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkConnection}
                    disabled={loading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Unlink className="mr-2 h-4 w-4" />
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the connection to {connectionStatus.email}. You can reconnect
                          anytime, but you&apos;ll need to authorize again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Button onClick={handleConnect} disabled={connecting || loading}>
                  {connecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  Connect Google Account
                </Button>
              )}
            </div>
          </div>
        </div>

        {connectionStatus?.connected && (
          <>
            <Separator />

            {/* Export Button */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-base">Export to Google Sheets</Label>
                <p className="text-sm text-muted-foreground">
                  Export all inventory data to a single spreadsheet with multiple tabs
                </p>
              </div>
              <Button onClick={() => setShowExportDialog(true)} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {exporting ? 'Exporting...' : 'Export to Sheets'}
              </Button>
            </div>

            <Separator />

            {/* Export History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Export History</Label>
                <Badge variant="outline">{exportHistory.length} exports</Badge>
              </div>

              {exportHistory.length > 0 ? (
                <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                  {exportHistory.map((exp) => (
                    <div key={exp.id} className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {exp.spreadsheet_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {exp.export_type}
                          </Badge>
                          <a
                            href={exp.spreadsheet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(exp.exported_at)}</span>
                        <span>
                          {exp.record_counts?.items || 0} items, {exp.record_counts?.transactions || 0} tx
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No exports yet</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Download Options */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Download className="h-4 w-4" />
                <span className="font-medium text-sm">Alternative Downloads</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                For local backups, use the Data Sharing section above for ZIP/JSON exports.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="#data-sharing">View Data Sharing Options</a>
              </Button>
            </div>
          </>
        )}

        {/* Export Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export to Google Sheets</DialogTitle>
              <DialogDescription>
                Export all inventory data to a spreadsheet in your Google Drive.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <RadioGroup value={exportMode} onValueChange={(v) => setExportMode(v as 'versioned' | 'overwrite')}>
                <div className="flex items-start space-x-3 rounded-lg border p-3">
                  <RadioGroupItem value="versioned" id="versioned" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="versioned" className="font-medium cursor-pointer">
                      Create new spreadsheet
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Creates a timestamped copy. Best for keeping export history.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-3">
                  <RadioGroupItem
                    value="overwrite"
                    id="overwrite"
                    className="mt-1"
                    disabled={exportHistory.length === 0}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="overwrite"
                      className={`font-medium cursor-pointer ${exportHistory.length === 0 ? 'opacity-50' : ''}`}
                    >
                      Overwrite last export
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {exportHistory.length > 0
                        ? `Updates "${exportHistory[0].spreadsheet_name}"`
                        : 'No previous export to overwrite'}
                    </p>
                  </div>
                </div>
              </RadioGroup>

              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium mb-1">Data to export:</p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  <li>• Items (with categories & locations)</li>
                  <li>• Locations</li>
                  <li>• Stock Transactions (last 5,000)</li>
                  <li>• Users</li>
                  <li>• System Logs (last 1,000)</li>
                  <li>• Export Metadata</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>
                <Upload className="mr-2 h-4 w-4" />
                Export Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
