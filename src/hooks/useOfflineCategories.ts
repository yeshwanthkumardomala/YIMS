import { useState, useEffect, useCallback } from 'react';
import { offlineDb, type OfflineCategory } from '@/lib/offlineDb';

export function useOfflineCategories() {
  const [categories, setCategories] = useState<OfflineCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await offlineDb.categories.where('isActive').equals(1).toArray();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(
    async (category: Omit<OfflineCategory, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const now = new Date();
        await offlineDb.categories.add({
          ...category,
          createdAt: now,
          updatedAt: now,
        });
        await fetchCategories();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to create category' };
      }
    },
    [fetchCategories]
  );

  const updateCategory = useCallback(
    async (id: number, updates: Partial<OfflineCategory>) => {
      try {
        await offlineDb.categories.update(id, {
          ...updates,
          updatedAt: new Date(),
        });
        await fetchCategories();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to update category' };
      }
    },
    [fetchCategories]
  );

  const deleteCategory = useCallback(
    async (id: number) => {
      try {
        // Check if category has items
        const itemsInCategory = await offlineDb.items.where('categoryId').equals(id).count();
        if (itemsInCategory > 0) {
          return {
            success: false,
            error: `Cannot delete category with ${itemsInCategory} items`,
          };
        }

        // Soft delete
        await offlineDb.categories.update(id, {
          isActive: false,
          updatedAt: new Date(),
        });
        await fetchCategories();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to delete category' };
      }
    },
    [fetchCategories]
  );

  const getCategoryById = useCallback(async (id: number) => {
    try {
      return await offlineDb.categories.get(id);
    } catch {
      return null;
    }
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
  };
}
