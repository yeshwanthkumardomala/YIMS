import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RefreshCw, Cloud, CloudOff, Check, AlertCircle } from 'lucide-react';
import { useDataSync, SyncProgress } from '@/hooks/useDataSync';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function SyncIndicator() {
  const { syncProgress, lastSyncTime, syncData, isSyncing } = useDataSync();
  const { isOnline, isOfflineMode } = useOfflineMode();
  const [open, setOpen] = useState(false);

  // Don't show if not in offline mode
  if (!isOfflineMode) {
    return null;
  }

  const handleSync = () => {
    syncData(true);
  };

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              isSyncing && "animate-pulse"
            )}
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isOnline ? (
              <Cloud className="h-4 w-4 text-green-500" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-500" />
            )}
            <span className="hidden sm:inline text-xs">
              {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Data Sync</h4>
              <Badge variant={isOnline ? 'default' : 'secondary'}>
                {isOnline ? 'Connected' : 'Offline'}
              </Badge>
            </div>

            {isSyncing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{syncProgress.currentStep}</span>
                  <span className="font-mono text-xs">{syncProgress.progress}%</span>
                </div>
                <Progress value={syncProgress.progress} className="h-2" />
                {syncProgress.syncedItems > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Synced {syncProgress.syncedItems} items
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {lastSyncTime ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Last synced {formatDistanceToNow(lastSyncTime)} ago</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>Never synced</span>
                  </div>
                )}

                {syncProgress.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2">
                    <p className="text-xs font-medium text-destructive mb-1">
                      {syncProgress.errors.length} sync error(s)
                    </p>
                    <ul className="text-xs text-destructive/80 space-y-0.5">
                      {syncProgress.errors.slice(0, 3).map((error, i) => (
                        <li key={i} className="truncate">• {error}</li>
                      ))}
                      {syncProgress.errors.length > 3 && (
                        <li>...and {syncProgress.errors.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={handleSync}
                  disabled={!isOnline || isSyncing}
                  className="w-full"
                  size="sm"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>

                {!isOnline && (
                  <p className="text-xs text-center text-muted-foreground">
                    Connect to the internet to sync your data
                  </p>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
