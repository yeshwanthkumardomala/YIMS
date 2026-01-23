import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings as SettingsIcon,
  Palette,
  Bell,
  Package,
  Monitor,
  Moon,
  Sun,
  Save,
  RotateCcw,
  Database,
  HardDrive,
  Trash2,
  Download,
  Upload,
  WifiOff,
  Cloud,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '@/hooks/useSettings';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineDb } from '@/lib/offlineDb';
import { getStorageInfo, getRecordCounts, downloadExportFile } from '@/lib/offlineDataUtils';
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

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { isOfflineMode, isOnline, setOfflineMode } = useOfflineMode();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ used: string; available: string; percentage: number } | null>(null);
  const [recordCounts, setRecordCounts] = useState<{ categories: number; locations: number; items: number; itemVariants: number; stockTransactions: number } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);

  // Sync theme with next-themes
  useEffect(() => {
    if (theme && theme !== settings.theme) {
      setSettings((prev) => ({ ...prev, theme: theme as AppSettings['theme'] }));
    }
  }, [theme]);

  // Load storage info
  useEffect(() => {
    async function loadStorageInfo() {
      setLoadingStorage(true);
      try {
        const [storage, counts] = await Promise.all([
          getStorageInfo(),
          getRecordCounts(),
        ]);
        setStorageInfo(storage);
        setRecordCounts(counts);
      } catch (error) {
        console.error('Failed to load storage info:', error);
      } finally {
        setLoadingStorage(false);
      }
    }
    loadStorageInfo();
  }, [isOfflineMode]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);

    // Apply theme immediately
    if (key === 'theme') {
      setTheme(value as string);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    setHasChanges(false);
    toast.success('Settings saved successfully');
  };

  const handleReset = () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return;
    setSettings(DEFAULT_SETTINGS);
    setTheme(DEFAULT_SETTINGS.theme);
    saveSettings(DEFAULT_SETTINGS);
    setHasChanges(false);
    toast.success('Settings reset to defaults');
  };

  const handleToggleOfflineMode = (enabled: boolean) => {
    setOfflineMode(enabled);
    toast.success(enabled ? 'Offline mode enabled' : 'Offline mode disabled');
  };

  const handleClearOfflineData = async () => {
    try {
      await offlineDb.clearAllData();
      const [storage, counts] = await Promise.all([
        getStorageInfo(),
        getRecordCounts(),
      ]);
      setStorageInfo(storage);
      setRecordCounts(counts);
      toast.success('Offline data cleared successfully');
    } catch (error) {
      toast.error('Failed to clear offline data');
    }
  };

  const handleExportData = async () => {
    try {
      await downloadExportFile();
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure system preferences and defaults</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Offline & Storage Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Offline & Storage
            </CardTitle>
            <CardDescription>Manage offline mode and local data storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Offline Mode Toggle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Offline Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Store all data locally on this device
                    </p>
                  </div>
                  <Switch
                    checked={isOfflineMode}
                    onCheckedChange={handleToggleOfflineMode}
                  />
                </div>

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {isOnline ? (
                      <Cloud className="h-4 w-4 text-green-600" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm">
                      {isOnline ? 'Connected to internet' : 'No internet connection'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOfflineMode ? (
                      <Database className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Cloud className="h-4 w-4 text-primary" />
                    )}
                    <span className="text-sm">
                      {isOfflineMode ? 'Using local storage' : 'Using cloud storage'}
                    </span>
                  </div>
                </div>

                {isOfflineMode && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-medium">Offline Mode Active</p>
                        <p className="text-xs mt-1">
                          Data is stored only on this device. Export regularly to avoid data loss.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Storage Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Local Storage</Label>
                  {storageInfo && (
                    <Badge variant="outline" className="font-mono">
                      {storageInfo.used} used
                    </Badge>
                  )}
                </div>

                {storageInfo && (
                  <div className="space-y-2">
                    <Progress value={storageInfo.percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {storageInfo.available} available
                    </p>
                  </div>
                )}

                {recordCounts && (
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-medium mb-2">Offline Records</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Items:</span>
                        <span>{recordCounts.items}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categories:</span>
                        <span>{recordCounts.categories}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Locations:</span>
                        <span>{recordCounts.locations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transactions:</span>
                        <span>{recordCounts.stockTransactions}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportData}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all offline data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all locally stored data including items, categories, locations, and transactions. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearOfflineData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Clear All Data
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize how the application looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={settings.theme === 'light' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => updateSetting('theme', 'light')}
                >
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </Button>
                <Button
                  variant={settings.theme === 'dark' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => updateSetting('theme', 'dark')}
                >
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </Button>
                <Button
                  variant={settings.theme === 'system' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => updateSetting('theme', 'system')}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  System
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Compact Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Use smaller spacing and fonts
                </p>
              </div>
              <Switch
                checked={settings.compactMode}
                onCheckedChange={(checked) => updateSetting('compactMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Item Codes</Label>
                <p className="text-sm text-muted-foreground">
                  Display QR/barcode values in lists
                </p>
              </div>
              <Switch
                checked={settings.showItemCodes}
                onCheckedChange={(checked) => updateSetting('showItemCodes', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Quick Add Button</Label>
                <p className="text-sm text-muted-foreground">
                  Show floating button for quick access
                </p>
              </div>
              <Switch
                checked={settings.showQuickAddToolbar}
                onCheckedChange={(checked) => updateSetting('showQuickAddToolbar', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Manage alerts and feedback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Toast Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show popup notifications for actions
                </p>
              </div>
              <Switch
                checked={settings.showToastNotifications}
                onCheckedChange={(checked) => updateSetting('showToastNotifications', checked)}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="toastDuration">Notification Duration</Label>
              <div className="flex items-center gap-3">
                <Select
                  value={settings.toastDuration.toString()}
                  onValueChange={(value) => updateSetting('toastDuration', parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 seconds</SelectItem>
                    <SelectItem value="3">3 seconds</SelectItem>
                    <SelectItem value="4">4 seconds (default)</SelectItem>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="8">8 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sound on Scan</Label>
                <p className="text-sm text-muted-foreground">
                  Play audio feedback when scanning
                </p>
              </div>
              <Switch
                checked={settings.playSoundOnScan}
                onCheckedChange={(checked) => updateSetting('playSoundOnScan', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stock Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock Defaults
            </CardTitle>
            <CardDescription>Default values for new items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultMinimumStock">Default Minimum Stock</Label>
                <Input
                  id="defaultMinimumStock"
                  type="number"
                  min="0"
                  value={settings.defaultMinimumStock}
                  onChange={(e) =>
                    updateSetting('defaultMinimumStock', parseInt(e.target.value) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Suggested minimum for new items
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultUnit">Default Unit</Label>
                <Select
                  value={settings.defaultUnit}
                  onValueChange={(value) => updateSetting('defaultUnit', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="l">Liters (l)</SelectItem>
                    <SelectItem value="ml">Milliliters (ml)</SelectItem>
                    <SelectItem value="m">Meters (m)</SelectItem>
                    <SelectItem value="cm">Centimeters (cm)</SelectItem>
                    <SelectItem value="box">Boxes</SelectItem>
                    <SelectItem value="pack">Packs</SelectItem>
                    <SelectItem value="set">Sets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="lowStockThreshold">Low Stock Warning (%)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min="0"
                  max="100"
                  className="w-24"
                  value={settings.lowStockWarningThreshold}
                  onChange={(e) =>
                    updateSetting(
                      'lowStockWarningThreshold',
                      Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                    )
                  }
                />
                <span className="text-sm text-muted-foreground">
                  Warn when stock is within {settings.lowStockWarningThreshold}% of minimum
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Display Options
            </CardTitle>
            <CardDescription>Table and list preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="itemsPerPage">Items Per Page</Label>
              <Select
                value={settings.itemsPerPage.toString()}
                onValueChange={(value) => updateSetting('itemsPerPage', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 items</SelectItem>
                  <SelectItem value="50">50 items (default)</SelectItem>
                  <SelectItem value="100">100 items</SelectItem>
                  <SelectItem value="200">200 items</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Number of items to show in tables
              </p>
            </div>

            <Separator />

            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="mb-2 font-medium">Current Settings Summary</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Theme: <span className="capitalize text-foreground">{settings.theme}</span></li>
                <li>• Compact mode: <span className="text-foreground">{settings.compactMode ? 'On' : 'Off'}</span></li>
                <li>• Default min stock: <span className="text-foreground">{settings.defaultMinimumStock} {settings.defaultUnit}</span></li>
                <li>• Low stock warning: <span className="text-foreground">{settings.lowStockWarningThreshold}%</span></li>
                <li>• Offline mode: <span className="text-foreground">{isOfflineMode ? 'On' : 'Off'}</span></li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 rounded-lg border bg-background p-4 shadow-lg">
          <p className="mb-2 text-sm font-medium">You have unsaved changes</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSettings(loadSettings());
                setHasChanges(false);
              }}
            >
              Discard
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
