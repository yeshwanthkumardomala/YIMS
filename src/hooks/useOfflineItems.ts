import { useState, useEffect, useCallback } from 'react';
import { offlineDb, type OfflineItem, type OfflineCategory, type OfflineLocation } from '@/lib/offlineDb';

export interface OfflineItemWithJoins extends OfflineItem {
  category?: OfflineCategory;
  location?: OfflineLocation;
}

export function useOfflineItems() {
  const [items, setItems] = useState<OfflineItemWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await offlineDb.getItemsWithJoins();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const createItem = useCallback(
    async (item: Omit<OfflineItem, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => {
      try {
        const code = await offlineDb.generateItemCode();
        const now = new Date();
        await offlineDb.items.add({
          ...item,
          code,
          createdAt: now,
          updatedAt: now,
        });
        await fetchItems();
        return { success: true, code };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to create item' };
      }
    },
    [fetchItems]
  );

  const updateItem = useCallback(
    async (id: number, updates: Partial<OfflineItem>) => {
      try {
        await offlineDb.items.update(id, {
          ...updates,
          updatedAt: new Date(),
        });
        await fetchItems();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to update item' };
      }
    },
    [fetchItems]
  );

  const deleteItem = useCallback(
    async (id: number) => {
      try {
        // Soft delete
        await offlineDb.items.update(id, {
          isActive: false,
          updatedAt: new Date(),
        });
        await fetchItems();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to delete item' };
      }
    },
    [fetchItems]
  );

  const getItemByCode = useCallback(async (code: string) => {
    try {
      const item = await offlineDb.items.where('code').equals(code).first();
      return item || null;
    } catch {
      return null;
    }
  }, []);

  const searchItems = useCallback(async (query: string) => {
    try {
      const allItems = await offlineDb.getItemsWithJoins();
      const lowerQuery = query.toLowerCase();
      return allItems.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.code.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery)
      );
    } catch {
      return [];
    }
  }, []);

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
    createItem,
    updateItem,
    deleteItem,
    getItemByCode,
    searchItems,
  };
}
