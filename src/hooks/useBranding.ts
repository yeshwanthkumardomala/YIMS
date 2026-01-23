import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BrandingSettings {
  id: string;
  logo_url: string | null;
  favicon_url: string | null;
  app_name: string;
  tagline: string | null;
  primary_color: string;
  version: number;
  updated_at: string;
}

const DEFAULT_BRANDING: Omit<BrandingSettings, 'id' | 'updated_at'> = {
  logo_url: null,
  favicon_url: null,
  app_name: 'YIMS',
  tagline: 'Yesh Inventory Management System',
  primary_color: '#3b82f6',
  version: 1,
};

interface UseBrandingReturn {
  branding: BrandingSettings | null;
  loading: boolean;
  error: string | null;
  updateBranding: (updates: Partial<BrandingSettings>) => Promise<{ success: boolean; error?: string }>;
  uploadLogo: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  uploadFavicon: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  resetToDefault: () => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

export function useBranding(): UseBrandingReturn {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('branding_settings')
        .select('*')
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      if (data) {
        setBranding(data as BrandingSettings);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching branding:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch branding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const updateBranding = useCallback(async (
    updates: Partial<BrandingSettings>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!branding?.id) {
        return { success: false, error: 'No branding settings found' };
      }

      const { error: updateError } = await supabase
        .from('branding_settings')
        .update({
          ...updates,
          version: (branding.version || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', branding.id);

      if (updateError) throw updateError;

      await fetchBranding();
      return { success: true };
    } catch (err) {
      console.error('Error updating branding:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to update branding' 
      };
    }
  }, [branding, fetchBranding]);

  const uploadFile = useCallback(async (
    file: File,
    type: 'logo' | 'favicon'
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      // Delete old file if exists
      const oldUrl = type === 'logo' ? branding?.logo_url : branding?.favicon_url;
      if (oldUrl) {
        const oldPath = oldUrl.split('/branding/')[1];
        if (oldPath) {
          await supabase.storage.from('branding').remove([oldPath]);
        }
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);

      // Update branding settings
      const updateField = type === 'logo' ? 'logo_url' : 'favicon_url';
      await updateBranding({ [updateField]: publicUrl });

      return { success: true, url: publicUrl };
    } catch (err) {
      console.error(`Error uploading ${type}:`, err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : `Failed to upload ${type}` 
      };
    }
  }, [branding, updateBranding]);

  const uploadLogo = useCallback((file: File) => uploadFile(file, 'logo'), [uploadFile]);
  const uploadFavicon = useCallback((file: File) => uploadFile(file, 'favicon'), [uploadFile]);

  const resetToDefault = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Delete uploaded files
      if (branding?.logo_url) {
        const logoPath = branding.logo_url.split('/branding/')[1];
        if (logoPath) await supabase.storage.from('branding').remove([logoPath]);
      }
      if (branding?.favicon_url) {
        const faviconPath = branding.favicon_url.split('/branding/')[1];
        if (faviconPath) await supabase.storage.from('branding').remove([faviconPath]);
      }

      // Reset to defaults
      await updateBranding({
        ...DEFAULT_BRANDING,
        logo_url: null,
        favicon_url: null,
      });

      return { success: true };
    } catch (err) {
      console.error('Error resetting branding:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to reset branding' 
      };
    }
  }, [branding, updateBranding]);

  return {
    branding,
    loading,
    error,
    updateBranding,
    uploadLogo,
    uploadFavicon,
    resetToDefault,
    refetch: fetchBranding,
  };
}
