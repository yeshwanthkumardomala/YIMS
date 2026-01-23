import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Share2,
  Package,
  FileText,
  Settings as SettingsIcon,
  Download,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logSystemEvent } from '@/lib/systemLogger';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface BundleOptions {
  includeInventory: boolean;
  includeLogs: boolean;
  includeConfig: boolean;
  includeBranding: boolean;
}

interface ShareLogEntry {
  timestamp: string;
  bundleType: string[];
  reason: string;
  sharedBy: string;
}

const SHARE_LOG_KEY = 'yims-share-log';

function loadShareLog(): ShareLogEntry[] {
  try {
    const stored = localStorage.getItem(SHARE_LOG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load share log:', e);
  }
  return [];
}

function saveShareLog(log: ShareLogEntry[]): void {
  localStorage.setItem(SHARE_LOG_KEY, JSON.stringify(log));
}

export function DataSharingSection() {
  const { profile, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reason, setReason] = useState('');
  const [options, setOptions] = useState<BundleOptions>({
    includeInventory: true,
    includeLogs: false,
    includeConfig: false,
    includeBranding: false,
  });
  const [shareLog, setShareLog] = useState<ShareLogEntry[]>(loadShareLog);

  const canIncludeConfig = isAdmin;

  const handleGenerateBundle = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for sharing');
      return;
    }

    if (!options.includeInventory && !options.includeLogs && !options.includeConfig && !options.includeBranding) {
      toast.error('Please select at least one data type to include');
      return;
    }

    setIsGenerating(true);

    try {
      const zip = new JSZip();
      const bundleTypes: string[] = [];
      const timestamp = new Date().toISOString().split('T')[0];

      // Add inventory data
      if (options.includeInventory) {
        bundleTypes.push('inventory');

        const { data: items } = await supabase
          .from('items')
          .select('*, category:categories(name), location:locations(name)')
          .eq('is_active', true);

        const { data: categories } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true);

        const { data: locations } = await supabase
          .from('locations')
          .select('*')
          .eq('is_active', true);

        zip.file('inventory/items.json', JSON.stringify(items || [], null, 2));
        zip.file('inventory/categories.json', JSON.stringify(categories || [], null, 2));
        zip.file('inventory/locations.json', JSON.stringify(locations || [], null, 2));
      }

      // Add transaction logs
      if (options.includeLogs) {
        bundleTypes.push('logs');

        const { data: transactions } = await supabase
          .from('stock_transactions')
          .select('*, item:items(code, name)')
          .order('created_at', { ascending: false })
          .limit(5000);

        const { data: systemLogs } = await supabase
          .from('system_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);

        zip.file('logs/stock_transactions.json', JSON.stringify(transactions || [], null, 2));
        zip.file('logs/system_logs.json', JSON.stringify(systemLogs || [], null, 2));
      }

      // Add config (admin only)
      if (options.includeConfig && canIncludeConfig) {
        bundleTypes.push('config');

        const { data: featureToggles } = await supabase
          .from('feature_toggles')
          .select('*');

        const { data: systemPolicies } = await supabase
          .from('system_policies')
          .select('*');

        zip.file('config/feature_toggles.json', JSON.stringify(featureToggles || [], null, 2));
        zip.file('config/system_policies.json', JSON.stringify(systemPolicies || [], null, 2));
      }

      // Add branding (admin only)
      if (options.includeBranding && canIncludeConfig) {
        bundleTypes.push('branding');

        const { data: branding } = await supabase
          .from('branding_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        zip.file('branding/settings.json', JSON.stringify(branding || {}, null, 2));
      }

      // Add metadata
      const metadata = {
        exportedAt: new Date().toISOString(),
        exportedBy: profile?.username || 'Unknown',
        reason: reason.trim(),
        includes: bundleTypes,
        version: '1.0.0',
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      // Generate and download
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `yims-bundle-${timestamp}.zip`);

      // Log the share action
      const newEntry: ShareLogEntry = {
        timestamp: new Date().toISOString(),
        bundleType: bundleTypes,
        reason: reason.trim(),
        sharedBy: profile?.username || 'Unknown',
      };

      const updatedLog = [newEntry, ...shareLog].slice(0, 50);
      setShareLog(updatedLog);
      saveShareLog(updatedLog);

      // Log to system
      await logSystemEvent({
        eventType: 'data_export',
        description: `Data bundle exported: ${bundleTypes.join(', ')}`,
        metadata: {
          bundleTypes,
          reason: reason.trim(),
        },
      });

      toast.success('Data bundle generated successfully');
      setIsOpen(false);
      setReason('');
    } catch (error) {
      console.error('Failed to generate bundle:', error);
      toast.error('Failed to generate data bundle');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Data Sharing
        </CardTitle>
        <CardDescription>
          Generate downloadable data bundles for sharing or archiving
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Admin-Controlled Sharing
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                All data exports are logged with timestamp, user, and reason. Bundles contain
                sensitive inventory data and should be handled securely.
              </p>
            </div>
          </div>
        </div>

        {/* Generate Bundle Button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Generate Data Bundle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Data Bundle</DialogTitle>
              <DialogDescription>
                Select data to include and provide a reason for this export.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Data Selection */}
              <div className="space-y-3">
                <Label>Include in Bundle</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="inventory"
                      checked={options.includeInventory}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeInventory: !!checked }))
                      }
                    />
                    <Label htmlFor="inventory" className="flex items-center gap-2 font-normal">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Inventory Snapshot
                      <span className="text-xs text-muted-foreground">(items, categories, locations)</span>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="logs"
                      checked={options.includeLogs}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeLogs: !!checked }))
                      }
                    />
                    <Label htmlFor="logs" className="flex items-center gap-2 font-normal">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Usage Logs
                      <span className="text-xs text-muted-foreground">(transactions, system logs)</span>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="config"
                      checked={options.includeConfig}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeConfig: !!checked }))
                      }
                      disabled={!canIncludeConfig}
                    />
                    <Label 
                      htmlFor="config" 
                      className={`flex items-center gap-2 font-normal ${!canIncludeConfig ? 'opacity-50' : ''}`}
                    >
                      <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                      Configuration
                      <span className="text-xs text-muted-foreground">(policies, toggles)</span>
                      {!canIncludeConfig && <Badge variant="outline">Admin only</Badge>}
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="branding"
                      checked={options.includeBranding}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeBranding: !!checked }))
                      }
                      disabled={!canIncludeConfig}
                    />
                    <Label 
                      htmlFor="branding" 
                      className={`flex items-center gap-2 font-normal ${!canIncludeConfig ? 'opacity-50' : ''}`}
                    >
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      Branding
                      <span className="text-xs text-muted-foreground">(logo, colors)</span>
                      {!canIncludeConfig && <Badge variant="outline">Admin only</Badge>}
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason" className="flex items-center gap-1">
                  Reason for Export
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., End of semester backup, Audit request, System migration..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This reason will be logged for audit purposes.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateBundle} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Generate & Download
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator />

        {/* Export History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Export History</Label>
            <Badge variant="outline">{shareLog.length} exports</Badge>
          </div>

          {shareLog.length > 0 ? (
            <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
              {shareLog.slice(0, 10).map((entry, index) => (
                <div key={index} className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{formatDate(entry.timestamp)}</span>
                    <div className="flex gap-1">
                      {entry.bundleType.map((type) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    "{entry.reason}" — {entry.sharedBy}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No exports recorded yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
