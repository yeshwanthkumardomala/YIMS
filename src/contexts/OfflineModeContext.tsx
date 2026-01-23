import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface OfflineModeContextType {
  isOfflineMode: boolean;
  isOnline: boolean;
  isElectron: boolean;
  setOfflineMode: (enabled: boolean) => void;
  toggleOfflineMode: () => void;
}

const OfflineModeContext = createContext<OfflineModeContextType | undefined>(undefined);

// Check if running in Electron
function detectElectron(): boolean {
  // Check for Electron-specific properties
  if (typeof window !== 'undefined') {
    // @ts-ignore - Electron injects this
    if (window.process && window.process.type === 'renderer') {
      return true;
    }
    // Check user agent
    if (navigator.userAgent.toLowerCase().includes('electron')) {
      return true;
    }
  }
  return false;
}

// Load offline mode preference from storage
function loadOfflineModePreference(): boolean {
  try {
    const settings = localStorage.getItem('yims-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.offlineMode === true;
    }
  } catch {
    // Ignore errors
  }
  return false;
}

// Save offline mode preference to storage
function saveOfflineModePreference(enabled: boolean): void {
  try {
    const settings = localStorage.getItem('yims-settings');
    const parsed = settings ? JSON.parse(settings) : {};
    parsed.offlineMode = enabled;
    localStorage.setItem('yims-settings', JSON.stringify(parsed));
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('offline-mode-changed', { detail: enabled }));
  } catch {
    // Ignore errors
  }
}

interface OfflineModeProviderProps {
  children: ReactNode;
}

export function OfflineModeProvider({ children }: OfflineModeProviderProps) {
  const [isElectron] = useState(() => detectElectron());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isOfflineMode, setIsOfflineModeState] = useState(() => {
    // Auto-enable offline mode in Electron
    if (detectElectron()) return true;
    return loadOfflineModePreference();
  });

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for storage changes (sync across tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'yims-settings') {
        const newValue = loadOfflineModePreference();
        setIsOfflineModeState(newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setOfflineMode = useCallback((enabled: boolean) => {
    setIsOfflineModeState(enabled);
    saveOfflineModePreference(enabled);
  }, []);

  const toggleOfflineMode = useCallback(() => {
    setOfflineMode(!isOfflineMode);
  }, [isOfflineMode, setOfflineMode]);

  const value: OfflineModeContextType = {
    isOfflineMode,
    isOnline,
    isElectron,
    setOfflineMode,
    toggleOfflineMode,
  };

  return <OfflineModeContext.Provider value={value}>{children}</OfflineModeContext.Provider>;
}

export function useOfflineMode(): OfflineModeContextType {
  const context = useContext(OfflineModeContext);
  if (context === undefined) {
    throw new Error('useOfflineMode must be used within an OfflineModeProvider');
  }
  return context;
}
