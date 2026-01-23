import { useState, useEffect, useCallback } from 'react';
import { offlineDb, type OfflineStockTransaction, type OfflineItem } from '@/lib/offlineDb';

export interface OfflineTransactionWithItem extends OfflineStockTransaction {
  item?: OfflineItem;
}

export function useOfflineStock() {
  const [transactions, setTransactions] = useState<OfflineTransactionWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (limit = 100) => {
    try {
      setLoading(true);
      const data = await offlineDb.getTransactionsWithItems(limit);
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const stockIn = useCallback(
    async (
      itemId: number,
      quantity: number,
      performedBy: string,
      notes?: string,
      variantId?: number
    ) => {
      try {
        await offlineDb.performStockOperation(
          itemId,
          'stock_in',
          quantity,
          performedBy,
          notes,
          undefined,
          variantId
        );
        await fetchTransactions();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to perform stock in' };
      }
    },
    [fetchTransactions]
  );

  const stockOut = useCallback(
    async (
      itemId: number,
      quantity: number,
      performedBy: string,
      notes?: string,
      recipient?: string,
      variantId?: number
    ) => {
      try {
        // Check if there's enough stock
        if (variantId) {
          const variant = await offlineDb.itemVariants.get(variantId);
          if (!variant || variant.currentStock < quantity) {
            return { success: false, error: 'Insufficient stock' };
          }
        } else {
          const item = await offlineDb.items.get(itemId);
          if (!item || item.currentStock < quantity) {
            return { success: false, error: 'Insufficient stock' };
          }
        }

        await offlineDb.performStockOperation(
          itemId,
          'stock_out',
          quantity,
          performedBy,
          notes,
          recipient,
          variantId
        );
        await fetchTransactions();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to perform stock out' };
      }
    },
    [fetchTransactions]
  );

  const adjustment = useCallback(
    async (
      itemId: number,
      quantity: number, // Can be positive or negative
      performedBy: string,
      notes?: string,
      variantId?: number
    ) => {
      try {
        await offlineDb.performStockOperation(
          itemId,
          'adjustment',
          quantity,
          performedBy,
          notes,
          undefined,
          variantId
        );
        await fetchTransactions();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to perform adjustment' };
      }
    },
    [fetchTransactions]
  );

  const getTransactionsByItem = useCallback(async (itemId: number, limit = 50) => {
    try {
      const allTransactions = await offlineDb.stockTransactions
        .where('itemId')
        .equals(itemId)
        .reverse()
        .sortBy('createdAt');
      return allTransactions.slice(0, limit);
    } catch {
      return [];
    }
  }, []);

  const getTransactionsByDateRange = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      return await offlineDb.stockTransactions
        .where('createdAt')
        .between(startDate, endDate)
        .toArray();
    } catch {
      return [];
    }
  }, []);

  const getDashboardStats = useCallback(async () => {
    try {
      return await offlineDb.getDashboardStats();
    } catch {
      return {
        totalItems: 0,
        lowStockCount: 0,
        totalLocations: 0,
        recentTransactions: 0,
      };
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    stockIn,
    stockOut,
    adjustment,
    getTransactionsByItem,
    getTransactionsByDateRange,
    getDashboardStats,
  };
}
