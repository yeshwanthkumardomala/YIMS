/**
 * Local Scan Server for ESP32 Offline Mode
 * 
 * This module provides local network scan capabilities when running
 * in Electron or as a PWA, allowing ESP32 devices to query the
 * local IndexedDB without requiring internet access.
 */

import { offlineDb, type OfflineItem, type OfflineLocation } from './offlineDb';

export interface LocalScanRequest {
  code: string;
  device_id: string;
}

export interface LocalScanResponse {
  success: boolean;
  type?: 'item' | 'location';
  data?: {
    name: string;
    current_stock?: number;
    minimum_stock?: number;
    unit?: string;
    location_type?: string;
    code: string;
  };
  error?: string;
  timestamp: string;
  offline: boolean;
}

export interface PendingScan {
  id: string;
  code: string;
  device_id: string;
  timestamp: string;
  synced: boolean;
}

const PENDING_SCANS_KEY = 'yims-pending-esp32-scans';

/**
 * Process a scan request against the local IndexedDB
 */
export async function processLocalScan(request: LocalScanRequest): Promise<LocalScanResponse> {
  const { code, device_id } = request;
  const timestamp = new Date().toISOString();
  
  try {
    // Check if it's an item code
    if (code.startsWith('YIMS:ITEM:')) {
      const item = await offlineDb.items.where('code').equals(code).first();
      
      if (item && item.isActive) {
        // Get category and location for additional context
        const category = item.categoryId 
          ? await offlineDb.categories.get(item.categoryId) 
          : undefined;
        const location = item.locationId 
          ? await offlineDb.locations.get(item.locationId) 
          : undefined;
        
        // Queue for sync later
        await queuePendingScan(code, device_id, timestamp);
        
        return {
          success: true,
          type: 'item',
          data: {
            name: item.name,
            current_stock: item.currentStock,
            minimum_stock: item.minimumStock,
            unit: item.unit,
            code: item.code,
          },
          timestamp,
          offline: true,
        };
      }
    }
    
    // Check if it's a location code
    if (code.match(/^YIMS:(BUILDING|ROOM|SHELF|BOX|DRAWER):/)) {
      const location = await offlineDb.locations.where('code').equals(code).first();
      
      if (location && location.isActive) {
        // Queue for sync later
        await queuePendingScan(code, device_id, timestamp);
        
        return {
          success: true,
          type: 'location',
          data: {
            name: location.name,
            location_type: location.locationType,
            code: location.code,
          },
          timestamp,
          offline: true,
        };
      }
    }
    
    // Not found
    return {
      success: false,
      error: 'Code not found in local database',
      timestamp,
      offline: true,
    };
  } catch (error) {
    console.error('Local scan error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error',
      timestamp,
      offline: true,
    };
  }
}

/**
 * Queue a scan for later sync to cloud
 */
async function queuePendingScan(code: string, device_id: string, timestamp: string): Promise<void> {
  try {
    const pendingScans = getPendingScans();
    pendingScans.push({
      id: crypto.randomUUID(),
      code,
      device_id,
      timestamp,
      synced: false,
    });
    localStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(pendingScans));
  } catch (error) {
    console.error('Failed to queue pending scan:', error);
  }
}

/**
 * Get all pending scans that need to be synced
 */
export function getPendingScans(): PendingScan[] {
  try {
    const data = localStorage.getItem(PENDING_SCANS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get count of unsynced scans
 */
export function getUnsyncedCount(): number {
  return getPendingScans().filter(s => !s.synced).length;
}

/**
 * Mark scans as synced
 */
export function markScansAsSynced(scanIds: string[]): void {
  const scans = getPendingScans();
  const updated = scans.map(scan => ({
    ...scan,
    synced: scanIds.includes(scan.id) ? true : scan.synced,
  }));
  localStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(updated));
}

/**
 * Clear synced scans from storage
 */
export function clearSyncedScans(): void {
  const scans = getPendingScans().filter(s => !s.synced);
  localStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(scans));
}

/**
 * Get the local server configuration status
 */
export interface LocalServerConfig {
  enabled: boolean;
  port: number;
  lastStarted?: string;
}

const LOCAL_SERVER_CONFIG_KEY = 'yims-local-server-config';

export function getLocalServerConfig(): LocalServerConfig {
  try {
    const data = localStorage.getItem(LOCAL_SERVER_CONFIG_KEY);
    return data ? JSON.parse(data) : { enabled: false, port: 8080 };
  } catch {
    return { enabled: false, port: 8080 };
  }
}

export function setLocalServerConfig(config: Partial<LocalServerConfig>): void {
  const current = getLocalServerConfig();
  localStorage.setItem(LOCAL_SERVER_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  // Check for Electron-specific properties
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  return userAgent.includes('electron');
}

/**
 * Format server URL for ESP32 configuration
 */
export function formatServerUrl(ip: string, port: number): string {
  return `http://${ip}:${port}/api/scan`;
}
