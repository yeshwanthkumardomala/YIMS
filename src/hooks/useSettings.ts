import { useState, useEffect, useCallback } from 'react';

// Settings types - exported for use across the app
export interface AppSettings {
  // Theme
  theme: 'light' | 'dark' | 'system';
  
  // Notifications
  showToastNotifications: boolean;
  toastDuration: number; // in seconds
  playSoundOnScan: boolean;
  
  // Stock defaults
  defaultMinimumStock: number;
  defaultUnit: string;
  lowStockWarningThreshold: number; // percentage below minimum
  
  // Display
  itemsPerPage: number;
  showItemCodes: boolean;
  compactMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  showToastNotifications: true,
  toastDuration: 4,
  playSoundOnScan: true,
  defaultMinimumStock: 10,
  defaultUnit: 'pcs',
  lowStockWarningThreshold: 20,
  itemsPerPage: 50,
  showItemCodes: true,
  compactMode: false,
};

const STORAGE_KEY = 'yims-settings';

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Hook to access and react to settings changes across the app
 */
export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    const handleSettingsChange = (event: CustomEvent<AppSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('settings-changed', handleSettingsChange as EventListener);
    return () => {
      window.removeEventListener('settings-changed', handleSettingsChange as EventListener);
    };
  }, []);

  return settings;
}

/**
 * Get a specific setting value
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = loadSettings();
  return settings[key];
}
