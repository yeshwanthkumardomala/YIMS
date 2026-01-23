// YIMS Database Types

export type AppRole = 'admin' | 'operator' | 'student';
export type LocationType = 'building' | 'room' | 'shelf' | 'box' | 'drawer';
export type TransactionType = 'stock_in' | 'stock_out' | 'adjustment';

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  granted_by: string | null;
  granted_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  location_type: LocationType;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  parent?: Location | null;
  children?: Location[];
  path?: string;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  location_id: string | null;
  current_stock: number;
  minimum_stock: number;
  unit: string;
  image_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  category?: Category | null;
  location?: Location | null;
}

export interface StockTransaction {
  id: string;
  item_id: string;
  transaction_type: TransactionType;
  quantity: number;
  balance_before: number;
  balance_after: number;
  location_id: string | null;
  notes: string | null;
  recipient: string | null;
  performed_by: string;
  created_at: string;
  // Computed/joined fields
  item?: Item | null;
  location?: Location | null;
  performer?: Profile | null;
}

export interface UsageHistory {
  id: string;
  item_id: string;
  quantity: number;
  purpose: string | null;
  used_by: string;
  recorded_by: string;
  notes: string | null;
  created_at: string;
  // Computed/joined fields
  item?: Item | null;
  user?: Profile | null;
  recorder?: Profile | null;
}

export interface ScanLog {
  id: string;
  code_scanned: string;
  code_type: string | null;
  item_id: string | null;
  location_id: string | null;
  scanned_by: string;
  action_taken: string | null;
  created_at: string;
}

export interface SystemLog {
  id: string;
  event_type: string;
  event_description: string;
  user_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Dashboard stats
export interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  totalLocations: number;
  recentTransactions: number;
}
