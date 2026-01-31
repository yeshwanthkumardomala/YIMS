// YIMS Database Types

export type AppRole = 'super_admin' | 'admin' | 'lab_manager' | 'operator' | 'student' | 'auditor';
export type LocationType = 'building' | 'room' | 'shelf' | 'box' | 'drawer';
export type TransactionType = 'stock_in' | 'stock_out' | 'adjustment';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalRequestType = 'large_stock_out' | 'new_item' | 'item_update' | 'data_reset';

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
  color: string;
  icon: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
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
  has_variants: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  category?: Category | null;
  location?: Location | null;
  variants?: ItemVariant[];
}

export interface ItemVariant {
  id: string;
  parent_item_id: string;
  variant_name: string;
  variant_attributes: Record<string, string>;
  sku_suffix: string | null;
  current_stock: number;
  minimum_stock: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  parent_item?: Item | null;
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

export interface ApprovalRequest {
  id: string;
  request_type: ApprovalRequestType;
  requested_by: string;
  item_id: string | null;
  variant_id: string | null;
  quantity: number | null;
  threshold_exceeded: number | null;
  reason: string | null;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Computed/joined fields
  requester?: Profile | null;
  reviewer?: Profile | null;
  item?: Item | null;
}

export interface AppSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

// Dashboard stats
export interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  totalLocations: number;
  recentTransactions: number;
}

// Filter types for advanced filtering
export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface StockRange {
  min: number;
  max: number;
}

export interface ItemFilters {
  search: string;
  categories: string[];
  locations: string[];
  stockRange: StockRange;
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  hasVariants: 'all' | 'yes' | 'no';
}

export interface TransactionFilters {
  search: string;
  dateRange: DateRange;
  types: TransactionType[];
  users: string[];
}
