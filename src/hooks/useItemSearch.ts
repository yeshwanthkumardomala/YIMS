import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from './useDebouncedCallback';
import type { Item } from '@/types/database';

interface SearchResult extends Item {
  rank?: number;
}

interface UseItemSearchOptions {
  limit?: number;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseItemSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  error: Error | null;
  totalCount: number;
}

export function useItemSearch(options: UseItemSearchOptions = {}): UseItemSearchReturn {
  const { limit = 50, debounceMs = 300, enabled = true } = options;
  const [query, setQueryRaw] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, debounceMs);

  const setQuery = useCallback((value: string) => {
    setQueryRaw(value);
    debouncedSetQuery(value);
  }, [debouncedSetQuery]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['item-search', debouncedQuery, limit],
    queryFn: async () => {
      // Use full-text search RPC function
      const { data, error } = await supabase.rpc('search_items', {
        search_query: debouncedQuery,
        p_limit: limit,
        p_offset: 0,
      });

      if (error) throw error;
      
      // Get total count for empty query
      const { count } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      return {
        items: (data as SearchResult[]) || [],
        totalCount: count || 0,
      };
    },
    enabled: enabled,
    staleTime: 1000 * 30, // Cache for 30 seconds
  });

  const isSearching = query !== debouncedQuery;

  return {
    query,
    setQuery,
    results: data?.items || [],
    isLoading,
    isSearching,
    error: error as Error | null,
    totalCount: data?.totalCount || 0,
  };
}
