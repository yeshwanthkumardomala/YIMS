import { useState, useEffect, useCallback } from 'react';
import { offlineDb, type OfflineLocation } from '@/lib/offlineDb';

export function useOfflineLocations() {
  const [locations, setLocations] = useState<OfflineLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await offlineDb.locations.where('isActive').equals(1).toArray();
      setLocations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const createLocation = useCallback(
    async (location: Omit<OfflineLocation, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => {
      try {
        const code = await offlineDb.generateLocationCode(location.locationType);
        const now = new Date();
        await offlineDb.locations.add({
          ...location,
          code,
          createdAt: now,
          updatedAt: now,
        });
        await fetchLocations();
        return { success: true, code };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to create location' };
      }
    },
    [fetchLocations]
  );

  const updateLocation = useCallback(
    async (id: number, updates: Partial<OfflineLocation>) => {
      try {
        await offlineDb.locations.update(id, {
          ...updates,
          updatedAt: new Date(),
        });
        await fetchLocations();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to update location' };
      }
    },
    [fetchLocations]
  );

  const deleteLocation = useCallback(
    async (id: number) => {
      try {
        // Check if location has items
        const itemsInLocation = await offlineDb.items.where('locationId').equals(id).count();
        if (itemsInLocation > 0) {
          return {
            success: false,
            error: `Cannot delete location with ${itemsInLocation} items`,
          };
        }

        // Check if location has child locations
        const childLocations = await offlineDb.locations.where('parentId').equals(id).count();
        if (childLocations > 0) {
          return {
            success: false,
            error: `Cannot delete location with ${childLocations} child locations`,
          };
        }

        // Soft delete
        await offlineDb.locations.update(id, {
          isActive: false,
          updatedAt: new Date(),
        });
        await fetchLocations();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to delete location' };
      }
    },
    [fetchLocations]
  );

  const getLocationById = useCallback(async (id: number) => {
    try {
      return await offlineDb.locations.get(id);
    } catch {
      return null;
    }
  }, []);

  const getLocationByCode = useCallback(async (code: string) => {
    try {
      return await offlineDb.locations.where('code').equals(code).first();
    } catch {
      return null;
    }
  }, []);

  // Build location tree
  const buildTree = useCallback(
    (parentId: number | null = null): (OfflineLocation & { children?: OfflineLocation[] })[] => {
      return locations
        .filter((loc) => (parentId === null ? !loc.parentId : loc.parentId === parentId))
        .map((loc) => ({
          ...loc,
          children: buildTree(loc.id!),
        }));
    },
    [locations]
  );

  return {
    locations,
    loading,
    error,
    refetch: fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    getLocationById,
    getLocationByCode,
    buildTree,
  };
}
