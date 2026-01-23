import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';

interface SafeModeError {
  code: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

interface SafeModeContextType {
  isSafeMode: boolean;
  error: SafeModeError | null;
  enterSafeMode: (error: SafeModeError) => void;
  exitSafeMode: () => void;
  recordError: (code: string, message: string, recoverable?: boolean) => void;
  errorHistory: SafeModeError[];
  clearErrorHistory: () => void;
}

const SafeModeContext = createContext<SafeModeContextType | undefined>(undefined);

const SAFE_MODE_KEY = 'yims-safe-mode';
const ERROR_HISTORY_KEY = 'yims-error-history';

export function SafeModeProvider({ children }: { children: ReactNode }) {
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [error, setError] = useState<SafeModeError | null>(null);
  const [errorHistory, setErrorHistory] = useState<SafeModeError[]>([]);

  // Load persisted state
  useEffect(() => {
    try {
      const storedSafeMode = localStorage.getItem(SAFE_MODE_KEY);
      if (storedSafeMode) {
        const parsed = JSON.parse(storedSafeMode);
        setIsSafeMode(parsed.active);
        if (parsed.error) {
          setError({
            ...parsed.error,
            timestamp: new Date(parsed.error.timestamp),
          });
        }
      }

      const storedHistory = localStorage.getItem(ERROR_HISTORY_KEY);
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        setErrorHistory(
          parsed.map((e: SafeModeError) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          }))
        );
      }
    } catch (e) {
      console.error('Failed to load safe mode state:', e);
    }
  }, []);

  // Persist state changes
  useEffect(() => {
    localStorage.setItem(
      SAFE_MODE_KEY,
      JSON.stringify({
        active: isSafeMode,
        error: error
          ? {
              ...error,
              timestamp: error.timestamp.toISOString(),
            }
          : null,
      })
    );
  }, [isSafeMode, error]);

  useEffect(() => {
    localStorage.setItem(
      ERROR_HISTORY_KEY,
      JSON.stringify(
        errorHistory.map((e) => ({
          ...e,
          timestamp: e.timestamp.toISOString(),
        }))
      )
    );
  }, [errorHistory]);

  const enterSafeMode = useCallback((newError: SafeModeError) => {
    setError(newError);
    setIsSafeMode(true);
    setErrorHistory((prev) => [newError, ...prev].slice(0, 50));

    toast.error('System entered Safe Mode', {
      description: newError.message,
      duration: 10000,
    });
  }, []);

  const exitSafeMode = useCallback(() => {
    setIsSafeMode(false);
    setError(null);
    localStorage.removeItem(SAFE_MODE_KEY);
    toast.success('Safe Mode exited');
  }, []);

  const recordError = useCallback(
    (code: string, message: string, recoverable = true) => {
      const newError: SafeModeError = {
        code,
        message,
        timestamp: new Date(),
        recoverable,
      };

      setErrorHistory((prev) => [newError, ...prev].slice(0, 50));

      if (!recoverable && !isSafeMode) {
        enterSafeMode(newError);
      }
    },
    [isSafeMode, enterSafeMode]
  );

  const clearErrorHistory = useCallback(() => {
    setErrorHistory([]);
    localStorage.removeItem(ERROR_HISTORY_KEY);
  }, []);

  return (
    <SafeModeContext.Provider
      value={{
        isSafeMode,
        error,
        enterSafeMode,
        exitSafeMode,
        recordError,
        errorHistory,
        clearErrorHistory,
      }}
    >
      {children}
    </SafeModeContext.Provider>
  );
}

export function useSafeMode() {
  const context = useContext(SafeModeContext);
  if (context === undefined) {
    throw new Error('useSafeMode must be used within a SafeModeProvider');
  }
  return context;
}
