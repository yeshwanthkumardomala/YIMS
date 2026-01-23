import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from './useSettings';

interface UseSessionTimeoutOptions {
  onTimeout: () => void;
  onWarning?: () => void;
  enabled?: boolean;
}

interface UseSessionTimeoutReturn {
  showWarning: boolean;
  remainingSeconds: number;
  resetTimer: () => void;
  extendSession: () => void;
}

// Default timeout values
const DEFAULT_TIMEOUT_MINUTES = 30;
const WARNING_BEFORE_SECONDS = 60; // Show warning 60 seconds before timeout

export function useSessionTimeout({
  onTimeout,
  onWarning,
  enabled = true,
}: UseSessionTimeoutOptions): UseSessionTimeoutReturn {
  const settings = useSettings();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(WARNING_BEFORE_SECONDS);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Get timeout duration from settings (0 means disabled)
  const timeoutMinutes = settings.toastDuration > 0 ? DEFAULT_TIMEOUT_MINUTES : 0;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled || timeoutMinutes === 0) return;

    clearTimers();
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingSeconds(WARNING_BEFORE_SECONDS);

    // Set warning timeout
    const warningTime = timeoutMs - (WARNING_BEFORE_SECONDS * 1000);
    if (warningTime > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        setShowWarning(true);
        setRemainingSeconds(WARNING_BEFORE_SECONDS);
        onWarning?.();
      }, warningTime);
    }

    // Set actual timeout
    timeoutRef.current = setTimeout(() => {
      setShowWarning(false);
      onTimeout();
    }, timeoutMs);
  }, [enabled, timeoutMinutes, timeoutMs, clearTimers, onTimeout, onWarning]);

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled || timeoutMinutes === 0) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      // Don't reset if warning is showing (user must explicitly click "Stay Logged In")
      if (!showWarning) {
        const now = Date.now();
        // Only reset if more than 1 second has passed (prevent excessive resets)
        if (now - lastActivityRef.current > 1000) {
          resetTimer();
        }
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetTimer();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [enabled, timeoutMinutes, showWarning, resetTimer, clearTimers]);

  return {
    showWarning,
    remainingSeconds,
    resetTimer,
    extendSession,
  };
}
