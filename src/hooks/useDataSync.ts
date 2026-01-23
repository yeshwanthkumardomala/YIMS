import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineDb } from '@/lib/offlineDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SyncProgress {
  issyncing: boolean;
  currentStep: string;
  progress: number; // 0-100
  totalItems: number;
  syncedItems: number;
  errors: string[];
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
}

export function useDataSync() {
  const { isOnline, isOfflineMode } = useOfflineMode();
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    issyncing: false,
    currentStep: '',
    progress: 0,
    totalItems: 0,
    syncedItems: 0,
    errors: [],
  });
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem('yims-last-sync');
    return stored ? new Date(stored) : null;
  });
  const syncInProgress = useRef(false);

  // Sync categories from offline to cloud
  const syncCategories = async (): Promise<SyncResult> => {
    const errors: string[] = [];
    let synced = 0;

    try {
      const offlineCategories = await offlineDb.categories.toArray();
      
      for (const cat of offlineCategories) {
        try {
          // Check if category exists by name
          const { data: existing } = await supabase
            .from('categories')
            .select('id, updated_at')
            .eq('name', cat.name)
            .maybeSingle();

          if (existing) {
            // Conflict resolution: compare timestamps, update if offline is newer
            const cloudUpdatedAt = new Date(existing.updated_at);
            if (cat.updatedAt > cloudUpdatedAt) {
              await supabase
                .from('categories')
                .update({
                  description: cat.description,
                  color: cat.color,
                  icon: cat.icon,
                  is_active: cat.isActive,
                })
                .eq('id', existing.id);
              synced++;
            }
          } else {
            // Insert new category
            await supabase.from('categories').insert({
              name: cat.name,
              description: cat.description,
              color: cat.color,
              icon: cat.icon,
              is_active: cat.isActive,
            });
            synced++;
          }
        } catch (err) {
          errors.push(`Category "${cat.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      errors.push(`Categories sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return { success: errors.length === 0, synced, errors };
  };

  // Sync locations from offline to cloud
  const syncLocations = async (): Promise<SyncResult> => {
    const errors: string[] = [];
    let synced = 0;

    try {
      const offlineLocations = await offlineDb.locations.toArray();
      
      for (const loc of offlineLocations) {
        try {
          const { data: existing } = await supabase
            .from('locations')
            .select('id, updated_at')
            .eq('code', loc.code)
            .maybeSingle();

          if (existing) {
            const cloudUpdatedAt = new Date(existing.updated_at);
            if (loc.updatedAt > cloudUpdatedAt) {
              await supabase
                .from('locations')
                .update({
                  name: loc.name,
                  description: loc.description,
                  location_type: loc.locationType,
                  is_active: loc.isActive,
                })
                .eq('id', existing.id);
              synced++;
            }
          } else {
            await supabase.from('locations').insert([{
              code: loc.code,
              name: loc.name,
              description: loc.description,
              location_type: loc.locationType,
              is_active: loc.isActive,
            }]);
            synced++;
          }
        } catch (err) {
          errors.push(`Location "${loc.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      errors.push(`Locations sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return { success: errors.length === 0, synced, errors };
  };

  // Sync items from offline to cloud
  const syncItems = async (): Promise<SyncResult> => {
    const errors: string[] = [];
    let synced = 0;

    try {
      const offlineItems = await offlineDb.items.toArray();
      
      for (const item of offlineItems) {
        try {
          const { data: existing } = await supabase
            .from('items')
            .select('id, updated_at')
            .eq('code', item.code)
            .maybeSingle();

          if (existing) {
            const cloudUpdatedAt = new Date(existing.updated_at);
            if (item.updatedAt > cloudUpdatedAt) {
              await supabase
                .from('items')
                .update({
                  name: item.name,
                  description: item.description,
                  current_stock: item.currentStock,
                  minimum_stock: item.minimumStock,
                  unit: item.unit,
                  is_active: item.isActive,
                  has_variants: item.hasVariants,
                })
                .eq('id', existing.id);
              synced++;
            }
          } else {
            await supabase.from('items').insert([{
              code: item.code,
              name: item.name,
              description: item.description,
              current_stock: item.currentStock,
              minimum_stock: item.minimumStock,
              unit: item.unit,
              is_active: item.isActive,
              has_variants: item.hasVariants,
            }]);
            synced++;
          }
        } catch (err) {
          errors.push(`Item "${item.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      errors.push(`Items sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return { success: errors.length === 0, synced, errors };
  };

  // Main sync function
  const syncData = useCallback(async (showToast = true) => {
    if (syncInProgress.current || !isOnline) return;
    
    syncInProgress.current = true;
    const allErrors: string[] = [];
    let totalSynced = 0;

    setSyncProgress({
      issyncing: true,
      currentStep: 'Starting sync...',
      progress: 0,
      totalItems: 0,
      syncedItems: 0,
      errors: [],
    });

    try {
      // Step 1: Sync categories (25%)
      setSyncProgress(prev => ({ ...prev, currentStep: 'Syncing categories...', progress: 10 }));
      const catResult = await syncCategories();
      totalSynced += catResult.synced;
      allErrors.push(...catResult.errors);

      // Step 2: Sync locations (50%)
      setSyncProgress(prev => ({ 
        ...prev, 
        currentStep: 'Syncing locations...', 
        progress: 35,
        syncedItems: totalSynced 
      }));
      const locResult = await syncLocations();
      totalSynced += locResult.synced;
      allErrors.push(...locResult.errors);

      // Step 3: Sync items (100%)
      setSyncProgress(prev => ({ 
        ...prev, 
        currentStep: 'Syncing items...', 
        progress: 60,
        syncedItems: totalSynced 
      }));
      const itemResult = await syncItems();
      totalSynced += itemResult.synced;
      allErrors.push(...itemResult.errors);

      // Complete
      setSyncProgress({
        issyncing: false,
        currentStep: 'Sync complete',
        progress: 100,
        totalItems: totalSynced,
        syncedItems: totalSynced,
        errors: allErrors,
      });

      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('yims-last-sync', now.toISOString());

      if (showToast) {
        if (allErrors.length > 0) {
          toast.warning(`Synced ${totalSynced} items with ${allErrors.length} errors`);
        } else if (totalSynced > 0) {
          toast.success(`Successfully synced ${totalSynced} items to cloud`);
        } else {
          toast.info('All data is up to date');
        }
      }
    } catch (error) {
      setSyncProgress(prev => ({
        ...prev,
        issyncing: false,
        currentStep: 'Sync failed',
        errors: [...prev.errors, error instanceof Error ? error.message : 'Unknown error'],
      }));
      if (showToast) {
        toast.error('Sync failed. Please try again.');
      }
    } finally {
      syncInProgress.current = false;
    }
  }, [isOnline]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && isOfflineMode) {
      // Small delay to ensure connection is stable
      const timer = setTimeout(() => {
        syncData(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isOfflineMode, syncData]);

  return {
    syncProgress,
    lastSyncTime,
    syncData,
    isSyncing: syncProgress.issyncing,
  };
}
