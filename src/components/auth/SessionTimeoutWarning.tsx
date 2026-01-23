import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';

interface SessionTimeoutWarningProps {
  open: boolean;
  remainingSeconds: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export function SessionTimeoutWarning({
  open,
  remainingSeconds,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutWarningProps) {
  const [countdown, setCountdown] = useState(remainingSeconds);

  useEffect(() => {
    setCountdown(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (!open) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, onLogout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs} seconds`;
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <AlertDialogTitle>Session Timeout Warning</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>
              Your session is about to expire due to inactivity.
            </p>
            <p className="text-lg font-semibold text-foreground">
              Time remaining: {formatTime(countdown)}
            </p>
            <p>
              Click "Stay Logged In" to continue your session, or you will be automatically logged out.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogout}>Log Out Now</AlertDialogCancel>
          <AlertDialogAction onClick={onStayLoggedIn}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
