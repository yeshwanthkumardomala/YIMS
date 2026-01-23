import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  HardDrive,
  Download,
  Clock,
  CheckCircle2,
  Loader2,
  Calendar,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadExportFile, getRecordCounts } from '@/lib/offlineDataUtils';

interface BackupConfig {
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  retentionCount: number;
  lastBackup: string | null;
}

const BACKUP_CONFIG_KEY = 'yims-backup-config';
const BACKUP_HISTORY_KEY = 'yims-backup-history';

function loadBackupConfig(): BackupConfig {
  try {
    const stored = localStorage.getItem(BACKUP_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load backup config:', e);
  }
  return {
    autoBackupEnabled: false,
    backupFrequency: 'weekly',
    retentionCount: 5,
    lastBackup: null,
  };
}

function saveBackupConfig(config: BackupConfig): void {
  localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(config));
}

interface BackupHistoryEntry {
  timestamp: string;
  type: 'manual' | 'auto';
  recordCounts: {
    items: number;
    categories: number;
    locations: number;
    stockTransactions: number;
  };
}

function loadBackupHistory(): BackupHistoryEntry[] {
  try {
    const stored = localStorage.getItem(BACKUP_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load backup history:', e);
  }
  return [];
}

function saveBackupHistory(history: BackupHistoryEntry[]): void {
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history));
}

export function BackupSchedulerSection() {
  const [config, setConfig] = useState<BackupConfig>(loadBackupConfig);
  const [history, setHistory] = useState<BackupHistoryEntry[]>(loadBackupHistory);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    saveBackupConfig(config);
  }, [config]);

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const counts = await getRecordCounts();
      await downloadExportFile();
      
      const newEntry: BackupHistoryEntry = {
        timestamp: new Date().toISOString(),
        type: 'manual',
        recordCounts: {
          items: counts.items,
          categories: counts.categories,
          locations: counts.locations,
          stockTransactions: counts.stockTransactions,
        },
      };

      const updatedHistory = [newEntry, ...history].slice(0, config.retentionCount);
      setHistory(updatedHistory);
      saveBackupHistory(updatedHistory);

      setConfig((prev) => ({
        ...prev,
        lastBackup: newEntry.timestamp,
      }));

      toast.success('Backup created successfully');
    } catch (error) {
      console.error('Backup failed:', error);
      toast.error('Failed to create backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getTimeSinceLastBackup = () => {
    if (!config.lastBackup) return 'Never';
    
    const lastBackup = new Date(config.lastBackup);
    const now = new Date();
    const diffMs = now.getTime() - lastBackup.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const isBackupOverdue = () => {
    if (!config.autoBackupEnabled || !config.lastBackup) return false;
    
    const lastBackup = new Date(config.lastBackup);
    const now = new Date();
    const diffMs = now.getTime() - lastBackup.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    switch (config.backupFrequency) {
      case 'daily':
        return diffDays > 1;
      case 'weekly':
        return diffDays > 7;
      case 'monthly':
        return diffDays > 30;
      default:
        return false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Backup & Recovery
        </CardTitle>
        <CardDescription>
          Schedule automatic backups and manage backup retention
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Manual Backup */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base">Manual Backup</Label>
            <p className="text-sm text-muted-foreground">
              Create a backup of all system data now
            </p>
          </div>
          <Button onClick={handleManualBackup} disabled={isBackingUp}>
            {isBackingUp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Backup Now
          </Button>
        </div>

        <Separator />

        {/* Backup Status */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Last Backup</span>
            </div>
            {config.lastBackup ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {getTimeSinceLastBackup()}
                </span>
                {isBackupOverdue() ? (
                  <Badge variant="destructive">Overdue</Badge>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>
            ) : (
              <Badge variant="outline">Never</Badge>
            )}
          </div>

          {config.lastBackup && (
            <p className="text-xs text-muted-foreground">
              {formatDate(config.lastBackup)}
            </p>
          )}

          {isBackupOverdue() && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Backup is overdue based on your schedule</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Auto Backup Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Automatic Backups</Label>
              <p className="text-sm text-muted-foreground">
                Reminder to backup based on schedule
              </p>
            </div>
            <Switch
              checked={config.autoBackupEnabled}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, autoBackupEnabled: checked }))
              }
            />
          </div>

          {config.autoBackupEnabled && (
            <div className="grid gap-4 md:grid-cols-2 pl-4 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor="frequency">Backup Frequency</Label>
                <Select
                  value={config.backupFrequency}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                    setConfig((prev) => ({ ...prev, backupFrequency: value }))
                  }
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retention">Keep Last</Label>
                <Select
                  value={config.retentionCount.toString()}
                  onValueChange={(value) =>
                    setConfig((prev) => ({ ...prev, retentionCount: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="retention">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 backups</SelectItem>
                    <SelectItem value="5">5 backups</SelectItem>
                    <SelectItem value="10">10 backups</SelectItem>
                    <SelectItem value="20">20 backups</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Backup History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Recent Backups</Label>
            <Badge variant="outline">{history.length} stored</Badge>
          </div>

          {history.length > 0 ? (
            <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
              {history.map((entry, index) => (
                <div key={index} className="p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {formatDate(entry.timestamp)}
                      </span>
                      <Badge variant={entry.type === 'manual' ? 'default' : 'secondary'}>
                        {entry.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        {entry.recordCounts.items} items
                      </span>
                      <span>{entry.recordCounts.stockTransactions} transactions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No backups recorded yet</p>
              <p className="text-xs">Create your first backup above</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
