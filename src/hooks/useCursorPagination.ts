import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Item } from '@/types/database';

interface CursorPaginationOptions {
  limit?: number;
  categoryId?: string | null;
  locationId?: string | null;
  stockStatus?: 'all' | 'low' | 'out' | 'ok';
  enabled?: boolean;
}

interface PaginationState {
  cursor: string | null;
  direction: 'next' | 'prev';
  history: string[]; // Stack of previous cursors for back navigation
}

interface UseCursorPaginationReturn {
  items: Item[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalCount: number;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

export function useCursorPagination(options: CursorPaginationOptions = {}): UseCursorPaginationReturn {
  const { 
    limit = 50, 
    categoryId = null, 
    locationId = null, 
    stockStatus = 'all',
    enabled = true 
  } = options;

  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({
    cursor: null,
    direction: 'next',
    history: [],
  });

  const queryKey = ['items-paginated', pagination.cursor, pagination.direction, categoryId, locationId, stockStatus, limit];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_items_paginated', {
        p_cursor: pagination.cursor,
        p_limit: limit,
        p_direction: pagination.direction,
        p_category_id: categoryId,
        p_location_id: locationId,
        p_stock_status: stockStatus,
      });

      if (error) throw error;

      // Parse the items from JSONB
      const result = data?.[0] as {
        items: unknown;
        next_cursor: string | null;
        prev_cursor: string | null;
        has_more: boolean;
        total_count: number;
      } | undefined;
      
      const parsedItems = Array.isArray(result?.items) ? result.items as Item[] : [];
      
      return {
        items: parsedItems,
        nextCursor: result?.next_cursor || null,
        prevCursor: result?.prev_cursor || null,
        hasMore: result?.has_more || false,
        totalCount: result?.total_count || 0,
      };
    },
    enabled,
    staleTime: 1000 * 30,
  });

  const nextPage = useCallback(() => {
    if (!data?.nextCursor || !data?.hasMore) return;

    setPagination((prev) => ({
      cursor: data.nextCursor,
      direction: 'next',
      history: prev.cursor ? [...prev.history, prev.cursor] : prev.history,
    }));
  }, [data?.nextCursor, data?.hasMore]);

  const prevPage = useCallback(() => {
    setPagination((prev) => {
      if (prev.history.length === 0) {
        return { cursor: null, direction: 'next', history: [] };
      }
      const newHistory = [...prev.history];
      const prevCursor = newHistory.pop() || null;
      return {
        cursor: prevCursor,
        direction: 'next',
        history: newHistory,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setPagination({ cursor: null, direction: 'next', history: [] });
    queryClient.invalidateQueries({ queryKey: ['items-paginated'] });
  }, [queryClient]);

  return {
    items: data?.items || [],
    isLoading,
    error: error as Error | null,
    hasNextPage: data?.hasMore || false,
    hasPrevPage: pagination.history.length > 0 || pagination.cursor !== null,
    totalCount: data?.totalCount || 0,
    nextPage,
    prevPage,
    reset,
  };
}
