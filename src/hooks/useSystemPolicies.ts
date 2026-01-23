import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface SystemPolicy {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
}

export interface NegativeStockPolicy {
  allowed: boolean;
  max_threshold: number;
  auto_resolve: boolean;
}

export interface RequireReasonPolicy {
  issue: boolean;
  consume: boolean;
  adjust: boolean;
  return: boolean;
}

export interface UndoSettingsPolicy {
  enabled: boolean;
  window_minutes: number;
}

export interface ConfirmationThresholdsPolicy {
  stock_out: number;
  adjust: number;
}

type PolicyKey = 'negative_stock' | 'require_reason' | 'require_project_tag' | 'undo_settings' | 'confirmation_thresholds';

interface UseSystemPoliciesReturn {
  policies: SystemPolicy[];
  loading: boolean;
  error: string | null;
  getPolicy: <T>(key: PolicyKey) => T | null;
  updatePolicy: (key: PolicyKey, value: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
  // Typed getters for common policies
  negativeStockPolicy: NegativeStockPolicy | null;
  requireReasonPolicy: RequireReasonPolicy | null;
  undoSettingsPolicy: UndoSettingsPolicy | null;
  confirmationThresholds: ConfirmationThresholdsPolicy | null;
}

const DEFAULT_POLICIES: Record<PolicyKey, Record<string, unknown>> = {
  negative_stock: { allowed: true, max_threshold: -100, auto_resolve: true },
  require_reason: { issue: true, consume: true, adjust: false, return: false },
  require_project_tag: { enabled: false, actions: ['issue', 'consume'] },
  undo_settings: { enabled: false, window_minutes: 15 },
  confirmation_thresholds: { stock_out: 50, adjust: 100 },
};

export function useSystemPolicies(): UseSystemPoliciesReturn {
  const [policies, setPolicies] = useState<SystemPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('system_policies')
        .select('*');

      if (fetchError) throw fetchError;
      // Transform the data to match our interface
      const transformed: SystemPolicy[] = (data || []).map(item => ({
        id: item.id,
        key: item.key,
        value: (typeof item.value === 'object' && item.value !== null && !Array.isArray(item.value)) 
          ? item.value as Record<string, unknown>
          : {},
        description: item.description,
        updated_at: item.updated_at,
      }));
      setPolicies(transformed);
      setError(null);
    } catch (err) {
      console.error('Error fetching system policies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const getPolicy = useCallback(<T,>(key: PolicyKey): T | null => {
    const policy = policies.find(p => p.key === key);
    if (policy?.value) {
      return policy.value as T;
    }
    // Return default if not found
    return (DEFAULT_POLICIES[key] as T) || null;
  }, [policies]);

  const updatePolicy = useCallback(async (
    key: PolicyKey, 
    value: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('system_policies')
        .update({ value: value as unknown as Json, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (updateError) throw updateError;

      // Update local state
      setPolicies(prev => prev.map(p => 
        p.key === key ? { ...p, value } : p
      ));

      return { success: true };
    } catch (err) {
      console.error('Error updating system policy:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to update policy' 
      };
    }
  }, []);

  // Typed policy getters
  const negativeStockPolicy = getPolicy<NegativeStockPolicy>('negative_stock');
  const requireReasonPolicy = getPolicy<RequireReasonPolicy>('require_reason');
  const undoSettingsPolicy = getPolicy<UndoSettingsPolicy>('undo_settings');
  const confirmationThresholds = getPolicy<ConfirmationThresholdsPolicy>('confirmation_thresholds');

  return {
    policies,
    loading,
    error,
    getPolicy,
    updatePolicy,
    refetch: fetchPolicies,
    negativeStockPolicy,
    requireReasonPolicy,
    undoSettingsPolicy,
    confirmationThresholds,
  };
}
