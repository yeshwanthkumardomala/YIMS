import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineDb } from '@/lib/offlineDb';

export function useQuickStartWizard() {
  const [shouldShowWizard, setShouldShowWizard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isOfflineMode } = useOfflineMode();

  useEffect(() => {
    checkIfShouldShowWizard();
  }, [isOfflineMode]);

  const checkIfShouldShowWizard = async () => {
    setIsLoading(true);
    try {
      // Check if wizard was already completed
      const wizardCompleted = localStorage.getItem('yims-wizard-completed');
      if (wizardCompleted === 'true') {
        setShouldShowWizard(false);
        setIsLoading(false);
        return;
      }

      // Check if user already has data
      if (isOfflineMode) {
        const categories = await offlineDb.categories.count();
        const items = await offlineDb.items.count();
        
        // Show wizard if no categories or items exist
        setShouldShowWizard(categories === 0 && items === 0);
      } else {
        // Check Supabase for existing data
        const { count: categoryCount } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true });
        
        const { count: itemCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true });
        
        // Show wizard if no categories or items exist
        setShouldShowWizard((categoryCount || 0) === 0 && (itemCount || 0) === 0);
      }
    } catch (error) {
      console.error('Error checking wizard status:', error);
      setShouldShowWizard(false);
    } finally {
      setIsLoading(false);
    }
  };

  const markWizardComplete = () => {
    localStorage.setItem('yims-wizard-completed', 'true');
    setShouldShowWizard(false);
  };

  const resetWizard = () => {
    localStorage.removeItem('yims-wizard-completed');
    checkIfShouldShowWizard();
  };

  return {
    shouldShowWizard,
    isLoading,
    markWizardComplete,
    resetWizard,
    checkIfShouldShowWizard,
  };
}
