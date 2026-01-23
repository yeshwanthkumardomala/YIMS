import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeatureToggle {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  category: string;
  updated_at: string;
}

export type FeatureKey = 
  | 'command_palette'
  | 'time_travel_view'
  | 'fast_text_parser'
  | 'live_presence'
  | 'analytics_panel'
  | 'camera_qr'
  | 'undo_transactions'
  | 'keyboard_first_mode'
  | 'glove_friendly_mode';

interface UseFeatureTogglesReturn {
  toggles: FeatureToggle[];
  loading: boolean;
  error: string | null;
  isEnabled: (key: FeatureKey) => boolean;
  setToggle: (key: FeatureKey, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

export function useFeatureToggles(): UseFeatureTogglesReturn {
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToggles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('feature_toggles')
        .select('*')
        .order('category', { ascending: true });

      if (fetchError) throw fetchError;
      setToggles(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching feature toggles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch toggles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToggles();
  }, [fetchToggles]);

  const isEnabled = useCallback((key: FeatureKey): boolean => {
    const toggle = toggles.find(t => t.key === key);
    return toggle?.enabled ?? false;
  }, [toggles]);

  const setToggle = useCallback(async (key: FeatureKey, enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('feature_toggles')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (updateError) throw updateError;

      // Update local state
      setToggles(prev => prev.map(t => 
        t.key === key ? { ...t, enabled } : t
      ));

      return { success: true };
    } catch (err) {
      console.error('Error updating feature toggle:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to update toggle' 
      };
    }
  }, []);

  return {
    toggles,
    loading,
    error,
    isEnabled,
    setToggle,
    refetch: fetchToggles,
  };
}

/**
 * Simple hook to check if a single feature is enabled
 */
export function useFeatureEnabled(key: FeatureKey): boolean {
  const { isEnabled } = useFeatureToggles();
  return isEnabled(key);
}
