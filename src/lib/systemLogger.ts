import { supabase } from '@/integrations/supabase/client';

export type SystemEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'signup'
  | 'item_created'
  | 'item_updated'
  | 'item_deleted'
  | 'location_created'
  | 'location_updated'
  | 'location_deleted'
  | 'stock_in'
  | 'stock_out'
  | 'stock_adjustment'
  | 'role_changed'
  | 'user_activated'
  | 'user_deactivated'
  | 'import_completed'
  | 'export_completed'
  | 'scan_performed'
  | 'error';

export interface LogEventOptions {
  eventType: SystemEventType;
  description: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}

/**
 * Log a system event to the system_logs table
 * This function is designed to fail silently to avoid disrupting user workflows
 */
export async function logSystemEvent({
  eventType,
  description,
  metadata,
  userId,
}: LogEventOptions): Promise<void> {
  try {
    // Get current user if not provided
    let logUserId = userId;
    if (!logUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      logUserId = user?.id;
    }

    await supabase.from('system_logs').insert([{
      event_type: eventType,
      event_description: description,
      user_id: logUserId || null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      ip_address: null, // Can't reliably get client IP from browser
    }]);
  } catch (error) {
    // Silently fail - logging should never break the app
    console.error('Failed to log system event:', error);
  }
}

/**
 * Get a human-readable label for event types
 */
export function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    login_success: 'Login Success',
    login_failed: 'Login Failed',
    logout: 'Logout',
    signup: 'Sign Up',
    item_created: 'Item Created',
    item_updated: 'Item Updated',
    item_deleted: 'Item Deleted',
    location_created: 'Location Created',
    location_updated: 'Location Updated',
    location_deleted: 'Location Deleted',
    stock_in: 'Stock In',
    stock_out: 'Stock Out',
    stock_adjustment: 'Stock Adjustment',
    role_changed: 'Role Changed',
    user_activated: 'User Activated',
    user_deactivated: 'User Deactivated',
    import_completed: 'Import Completed',
    export_completed: 'Export Completed',
    scan_performed: 'Scan Performed',
    error: 'Error',
  };
  return labels[eventType] || eventType;
}

/**
 * Get badge color variant for event types
 */
export function getEventTypeBadgeVariant(eventType: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    login_success: 'default',
    login_failed: 'destructive',
    logout: 'secondary',
    signup: 'default',
    item_created: 'default',
    item_updated: 'secondary',
    item_deleted: 'destructive',
    location_created: 'default',
    location_updated: 'secondary',
    location_deleted: 'destructive',
    stock_in: 'default',
    stock_out: 'outline',
    stock_adjustment: 'secondary',
    role_changed: 'destructive',
    user_activated: 'default',
    user_deactivated: 'destructive',
    import_completed: 'default',
    export_completed: 'secondary',
    scan_performed: 'outline',
    error: 'destructive',
  };
  return variants[eventType] || 'outline';
}

// List of all event types for filtering
export const ALL_EVENT_TYPES: SystemEventType[] = [
  'login_success',
  'login_failed',
  'logout',
  'signup',
  'item_created',
  'item_updated',
  'item_deleted',
  'location_created',
  'location_updated',
  'location_deleted',
  'stock_in',
  'stock_out',
  'stock_adjustment',
  'role_changed',
  'user_activated',
  'user_deactivated',
  'import_completed',
  'export_completed',
  'scan_performed',
  'error',
];
