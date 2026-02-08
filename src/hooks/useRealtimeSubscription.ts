import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionOptions {
  table: string;
  schema?: string;
  onAnyChange: () => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to Supabase realtime changes on a table.
 * Handles cleanup automatically on unmount.
 * Uses a simple refetch strategy for reliability.
 */
export function useRealtimeSubscription({
  table,
  schema = 'public',
  onAnyChange,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onChangeRef = useRef(onAnyChange);

  // Keep callback ref updated to avoid stale closures
  useEffect(() => {
    onChangeRef.current = onAnyChange;
  }, [onAnyChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Create unique channel name
    const channelName = `realtime-${table}-${Date.now()}`;
    
    console.log(`[Realtime] Subscribing to ${table}...`);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema, 
          table 
        },
        (payload) => {
          console.log(`[Realtime] ${table} change:`, payload.eventType, payload);
          onChangeRef.current();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] ${table} subscription status:`, status);
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log(`[Realtime] Unsubscribing from ${table}...`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, enabled]);

  // Return function to manually unsubscribe if needed
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  return { unsubscribe };
}

/**
 * Hook to subscribe to multiple tables at once.
 * Uses a simple refetch strategy - calls onAnyChange when any table changes.
 */
export function useMultiTableRealtime(
  tables: string[],
  onAnyChange: () => void,
  enabled = true
) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const onChangeRef = useRef(onAnyChange);

  useEffect(() => {
    onChangeRef.current = onAnyChange;
  }, [onAnyChange]);

  useEffect(() => {
    if (!enabled || tables.length === 0) {
      return;
    }

    console.log(`[Realtime] Subscribing to multiple tables:`, tables);

    // Create a channel for each table
    const channels: RealtimeChannel[] = tables.map((table, index) => {
      const channelName = `realtime-${table}-${Date.now()}-${index}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            console.log(`[Realtime] ${table} change:`, payload.eventType);
            onChangeRef.current();
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime] ${table} subscription status:`, status);
        });

      return channel;
    });

    channelsRef.current = channels;

    return () => {
      console.log(`[Realtime] Unsubscribing from multiple tables...`);
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [tables.join(','), enabled]);

  const unsubscribe = useCallback(() => {
    channelsRef.current.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
  }, []);

  return { unsubscribe };
}
