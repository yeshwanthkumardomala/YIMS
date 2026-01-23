import { WifiOff, Wifi, Database, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOfflineMode } from '@/contexts/OfflineModeContext';

export function OfflineIndicator() {
  const { isOfflineMode, isOnline, isElectron } = useOfflineMode();

  // Don't show anything if online and not in offline mode
  if (isOnline && !isOfflineMode) {
    return null;
  }

  // Show offline mode badge
  if (isOfflineMode) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            <Database className="h-3 w-3" />
            <span className="hidden sm:inline">Offline Mode</span>
            <span className="sm:hidden">Offline</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Data is stored locally on this device</p>
          {isElectron && <p className="text-xs text-muted-foreground">Running as desktop app</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Show no internet badge
  if (!isOnline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="destructive"
            className="gap-1"
          >
            <WifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">No Internet</span>
            <span className="sm:hidden">Offline</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>No internet connection</p>
          <p className="text-xs text-muted-foreground">Some features may be unavailable</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}

// Compact version for mobile/sidebar
export function OfflineIndicatorCompact() {
  const { isOfflineMode, isOnline } = useOfflineMode();

  if (isOnline && !isOfflineMode) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center h-8 w-8 rounded-md text-green-600 dark:text-green-400">
            <Cloud className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Connected to cloud</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isOfflineMode) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center h-8 w-8 rounded-md text-amber-600 dark:text-amber-400">
            <Database className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Offline Mode</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!isOnline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center h-8 w-8 rounded-md text-destructive">
            <WifiOff className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>No Internet</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
