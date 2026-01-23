import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Permission = 
  | 'manage_system_policies'
  | 'manage_feature_toggles'
  | 'manage_branding'
  | 'manage_users'
  | 'manage_roles'
  | 'view_system_logs'
  | 'manage_inventory'
  | 'manage_categories'
  | 'manage_locations'
  | 'perform_stock_operations'
  | 'view_reports'
  | 'manage_approvals'
  | 'export_data'
  | 'import_data';

interface UseRolePermissionsReturn {
  permissions: Permission[];
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
  refetch: () => Promise<void>;
}

export function useRolePermissions(): UseRolePermissionsReturn {
  const { user, role } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user || !role) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission')
        .eq('role', role)
        .eq('granted', true);

      if (error) throw error;
      
      setPermissions((data || []).map(p => p.permission as Permission));
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((permission: Permission): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  return {
    permissions,
    loading,
    hasPermission,
    refetch: fetchPermissions,
  };
}
