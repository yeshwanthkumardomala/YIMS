import { useSafeMode } from '@/contexts/SafeModeContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ShieldAlert,
  Download,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { downloadExportFile } from '@/lib/offlineDataUtils';
import { toast } from 'sonner';

export function SafeModeIndicator() {
  const { isSafeMode, error, exitSafeMode } = useSafeMode();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!isSafeMode) return null;

  const handleExport = async () => {
    try {
      await downloadExportFile();
      toast.success('Data exported successfully');
    } catch (e) {
      toast.error('Failed to export data');
    }
  };

  const handleRetry = () => {
    exitSafeMode();
    window.location.reload();
  };

  return (
    <>
      {/* Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <span className="font-medium">Safe Mode Active</span>
            <span className="text-sm opacity-90">— System is in read-only mode</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsDialogOpen(true)}
            >
              Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-transparent border-destructive-foreground/30 hover:bg-destructive-foreground/10"
              onClick={handleRetry}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>

      {/* Spacer to prevent content overlap */}
      <div className="h-12" />

      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Safe Mode Details
            </DialogTitle>
            <DialogDescription>
              The system has encountered an issue and is running in safe mode.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Error Info */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="destructive">{error.code}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {error.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{error.message}</p>
              </div>
            )}

            {/* What this means */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">What this means:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Write operations are temporarily disabled</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>You can still view all data and export backups</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Try refreshing the page to resolve temporary issues</span>
                </li>
              </ul>
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Recommended Actions:</h4>
              <div className="grid gap-2">
                <Button variant="outline" onClick={handleExport} className="justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Export Data Backup
                </Button>
                <Button variant="outline" onClick={handleRetry} className="justify-start">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry & Exit Safe Mode
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SafeModeBanner() {
  const { isSafeMode, exitSafeMode } = useSafeMode();

  if (!isSafeMode) return null;

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 mb-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-medium text-destructive">Safe Mode Active</p>
          <p className="text-sm text-muted-foreground">
            The system is running in read-only mode due to an error. You can view data and create
            backups, but write operations are disabled until the issue is resolved.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exitSafeMode}>
          <X className="mr-2 h-4 w-4" />
          Exit
        </Button>
      </div>
    </div>
  );
}
