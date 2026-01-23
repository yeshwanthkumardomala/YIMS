import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Download, Check, Smartphone, Monitor, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('yims-install-dismissed') === 'true';
  });

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
      setShowDialog(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('yims-install-dismissed', 'true');
  };

  // Don't render if already installed
  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-green-500" />
        <span>App Installed</span>
      </div>
    );
  }

  // Don't render if no prompt available or dismissed
  if (!deferredPrompt) {
    return null;
  }

  // Compact version for sidebar (always visible)
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDialog(true)}
              className="w-full justify-start gap-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5"
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="flex-1 text-left">Install App</span>
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                New
              </Badge>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Install YIMS for offline access
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Install Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Install YIMS
            </DialogTitle>
            <DialogDescription>
              Install YIMS on your device for the best experience
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Smartphone className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Works Offline</h4>
                <p className="text-xs text-muted-foreground">
                  Access your inventory even without internet connection
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Monitor className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Native Experience</h4>
                <p className="text-xs text-muted-foreground">
                  Opens in its own window, just like a desktop app
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Download className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Quick Access</h4>
                <p className="text-xs text-muted-foreground">
                  Launch from your home screen or dock instantly
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={handleDismiss} className="sm:order-1">
              <X className="h-4 w-4 mr-2" />
              Not now
            </Button>
            <Button onClick={handleInstallClick} disabled={isInstalling} className="sm:order-2">
              <Download className="h-4 w-4 mr-2" />
              {isInstalling ? 'Installing...' : 'Install Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
