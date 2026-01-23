import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '@/hooks/useSettings';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync theme with next-themes
  useEffect(() => {
    if (theme && theme !== settings.theme) {
      setSettings((prev) => ({ ...prev, theme: theme as AppSettings['theme'] }));
    }
  }, [theme]);

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
