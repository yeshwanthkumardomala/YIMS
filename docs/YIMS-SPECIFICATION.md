# YIMS — Yesh Inventory Management System
## Complete Technical Specification v1.0

> **Purpose**: This document serves as a complete blueprint to recreate YIMS from scratch. Give this to any developer or AI assistant to build the entire system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema](#3-database-schema)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Authentication](#5-authentication)
6. [Feature Specifications](#6-feature-specifications)
7. [Admin Panel Structure](#7-admin-panel-structure)
8. [Component Architecture](#8-component-architecture)
9. [Offline-First Architecture](#9-offline-first-architecture)
10. [Edge Functions](#10-edge-functions)
11. [Safe Mode](#11-safe-mode)
12. [UI/UX Requirements](#12-uiux-requirements)
13. [Pages & Routes](#13-pages--routes)
14. [Implementation Phases](#14-implementation-phases)
15. [Success Criteria](#15-success-criteria)

---

# 1. SYSTEM OVERVIEW

## 1.1 Project Identity

| Field | Value |
|-------|-------|
| **Name** | YIMS (Yesh Inventory Management System) |
| **Type** | Offline-First, Local Network Inventory System |
| **Primary Use** | Labs, Workshops, Educational & Institutional Stores |
| **Architecture** | React + Supabase (or local-first with Dexie.js) |

## 1.2 Hard Constraints

These are non-negotiable requirements that shape all design decisions:

- ✅ Runs on single Windows machine (or web browser)
- ✅ Accessed by multiple users over LAN
- ✅ No cloud dependency (offline-capable)
- ✅ Local database with sync capability
- ✅ Inventory quantity MAY go below zero (first-class negative stock)
- ✅ Every stock change is permanently logged
- ✅ Logs are append-only and immutable
- ✅ System must remain usable for many years

## 1.3 Core Design Philosophy

```
Reliability > Appearance
Auditability > Convenience
Stable UX for users, flexible controls for admins
Keyboard-first workflows
Human-error tolerant
All flexibility lives ONLY in Admin Panel
```

---

# 2. TECHNOLOGY STACK

## 2.1 Frontend

```json
{
  "framework": "React 18.3.1",
  "build": "Vite",
  "styling": "Tailwind CSS",
  "language": "TypeScript",
  "ui_components": "shadcn/ui (Radix primitives)",
  "state": "TanStack Query",
  "routing": "React Router DOM 6.x",
  "forms": "React Hook Form + Zod",
  "charts": "Recharts",
  "offline_db": "Dexie.js (IndexedDB)",
  "icons": "Lucide React",
  "toasts": "Sonner",
  "theme": "next-themes"
}
```

## 2.2 Backend (Supabase / Lovable Cloud)

```json
{
  "database": "PostgreSQL",
  "auth": "Supabase Auth (custom username flow)",
  "storage": "Supabase Storage (branding bucket)",
  "functions": "Edge Functions (Deno)",
  "realtime": "Supabase Realtime (optional)"
}
```

## 2.3 Desktop (Optional)

- Electron wrapper for standalone Windows app
- Auto-enables offline mode when running in Electron
- Uses IndexedDB for local persistence
- See `ELECTRON-README.md` for build instructions

## 2.4 Key Dependencies

```json
{
  "@supabase/supabase-js": "^2.91.0",
  "@tanstack/react-query": "^5.83.0",
  "dexie": "^4.2.1",
  "jszip": "^3.10.1",
  "html5-qrcode": "^2.3.8",
  "qrcode.react": "^4.2.0",
  "react-barcode": "^1.6.1",
  "otpauth": "^9.4.1",
  "file-saver": "^2.0.5",
  "recharts": "^2.15.4"
}
```

---

# 3. DATABASE SCHEMA

## 3.1 Enum Types

```sql
-- User roles in the system
CREATE TYPE public.app_role AS ENUM (
  'super_admin',  -- Full system access, policies, branding
  'admin',        -- User management, inventory, reports
  'lab_manager',  -- Inventory operations, categories, locations
  'operator',     -- Stock operations and reports only
  'student',      -- Basic stock operations only
  'auditor'       -- Read-only access to logs and reports
);

-- Location hierarchy types (5 levels)
CREATE TYPE public.location_type AS ENUM (
  'building',  -- Top level
  'room',      -- Inside building
  'shelf',     -- Inside room
  'box',       -- On shelf
  'drawer'     -- Inside box (lowest level)
);

-- Stock transaction types
CREATE TYPE public.transaction_type AS ENUM (
  'stock_in',    -- Items entering inventory (Return)
  'stock_out',   -- Items leaving inventory (Issue, Consume)
  'adjustment'   -- Manual correction (Adjust)
);
```

## 3.2 Core Tables

### profiles

User profile data linked to auth.users:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  force_password_change BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  backup_codes TEXT[],
  two_factor_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
```

### user_roles

Role assignments for users:

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- RLS Policies
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### categories

Item classification:

```sql
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Authenticated users can view, admins can modify
```

### locations

Hierarchical storage locations:

```sql
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,  -- Format: YIMS:ROOM:12345
  name TEXT NOT NULL,
  location_type location_type NOT NULL,
  parent_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for hierarchy queries
CREATE INDEX idx_locations_parent ON public.locations(parent_id);
CREATE INDEX idx_locations_type ON public.locations(location_type);
```

### items

Core inventory items:

```sql
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,  -- Format: YIMS:ITEM:XXXXX
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),
  location_id UUID REFERENCES public.locations(id),
  current_stock INTEGER NOT NULL DEFAULT 0,  -- CAN BE NEGATIVE
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  image_url TEXT,
  has_variants BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Full-text search vector
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(code, '')), 'A')
  ) STORED
);

-- Indexes
CREATE INDEX idx_items_category ON public.items(category_id);
CREATE INDEX idx_items_location ON public.items(location_id);
CREATE INDEX idx_items_search ON public.items USING GIN(search_vector);
CREATE INDEX idx_items_stock ON public.items(current_stock);
```

### item_variants

Variations of items (size, color, etc.):

```sql
CREATE TABLE public.item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  variant_name TEXT NOT NULL,
  variant_attributes JSONB DEFAULT '{}',  -- {"size": "L", "color": "red"}
  current_stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 0,
  sku_suffix TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### stock_transactions (APPEND-ONLY - IMMUTABLE)

**CRITICAL**: This table has NO UPDATE or DELETE policies. All entries are permanent.

```sql
CREATE TABLE public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
  transaction_type transaction_type NOT NULL,
  quantity INTEGER NOT NULL,  -- Positive or negative
  balance_before INTEGER NOT NULL,  -- Snapshot at time of transaction
  balance_after INTEGER NOT NULL,   -- Calculated result
  location_id UUID REFERENCES public.locations(id),
  notes TEXT,
  recipient TEXT,  -- For Issue operations
  project_tag TEXT,  -- Optional project reference
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at - records are immutable
);

-- RLS: Insert only, no update/delete
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions"
  ON public.stock_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create transactions"
  ON public.stock_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = performed_by);

-- NO UPDATE OR DELETE POLICIES - IMMUTABLE
```

### system_logs (APPEND-ONLY - IMMUTABLE)

**CRITICAL**: This table has NO UPDATE or DELETE policies. All entries are permanent.

```sql
CREATE TABLE public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  metadata JSONB,
  request_id UUID,
  duration_ms INTEGER,
  affected_rows INTEGER,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at - records are immutable
);

-- Event types: login_success, login_failed, logout, signup,
--              item_created, item_updated, item_deleted,
--              stock_in, stock_out, adjustment,
--              settings_changed, user_role_changed,
--              data_export, error, etc.
```

### feature_toggles

Admin-controlled feature flags (ALL OFF by default):

```sql
CREATE TABLE public.feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  category TEXT DEFAULT 'experimental',
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default toggles (insert on migration)
INSERT INTO public.feature_toggles (key, enabled, description, category) VALUES
  ('command_palette', false, 'Enable Ctrl+K command palette', 'ux'),
  ('time_travel_view', false, 'View inventory at past dates', 'experimental'),
  ('fast_text_parser', false, 'Parse text for quick item entry', 'experimental'),
  ('live_presence', false, 'Show other users online', 'experimental'),
  ('analytics_panel', false, 'Dashboard analytics charts', 'ux'),
  ('camera_qr', false, 'Camera-based QR scanning', 'experimental'),
  ('undo_transactions', false, 'Allow undoing recent transactions', 'ux'),
  ('keyboard_first_mode', false, 'Keyboard navigation optimization', 'ux'),
  ('glove_friendly_mode', false, 'Larger touch targets', 'ux');
```

### system_policies

Admin-controlled system behavior:

```sql
CREATE TABLE public.system_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default policies
INSERT INTO public.system_policies (key, value, description) VALUES
  ('negative_stock', 
   '{"allowed": true, "max_threshold": -100, "autoResolve": true}', 
   'Negative stock handling configuration'),
  
  ('require_reason', 
   '{"issue": true, "consume": true, "adjust": false, "return": false}', 
   'Which actions require mandatory notes'),
  
  ('require_project_tag', 
   '{"enabled": false, "actions": ["issue", "consume"]}', 
   'Project tag requirements'),
  
  ('undo_settings', 
   '{"enabled": false, "window_minutes": 15}', 
   'Undo transaction configuration'),
  
  ('confirmation_thresholds', 
   '{"stock_out": 50, "adjust": 100}', 
   'Quantity thresholds requiring confirmation');
```

### branding_settings

Custom branding for the application:

```sql
CREATE TABLE public.branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  favicon_url TEXT,
  app_name TEXT DEFAULT 'YIMS',
  tagline TEXT DEFAULT 'Yesh Inventory Management System',
  primary_color TEXT DEFAULT '#3b82f6',
  version INTEGER DEFAULT 1,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### role_permissions

Granular permission assignments:

```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- Available permissions:
-- manage_system_policies, manage_feature_toggles, manage_branding
-- manage_users, manage_roles, view_system_logs
-- manage_inventory, manage_categories, manage_locations
-- perform_stock_operations, view_reports, manage_approvals
-- export_data, import_data
```

### notifications

In-app notification system:

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',  -- info, warning, error, success
  category TEXT NOT NULL DEFAULT 'system',  -- system, stock, approval
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);
```

### approval_requests

Workflow for large operations:

```sql
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL,  -- large_stock_out, new_item, item_update
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  item_id UUID REFERENCES public.items(id),
  requested_by UUID REFERENCES auth.users(id) NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  request_data JSONB NOT NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
```

### webhook_configs & webhook_logs

External integrations:

```sql
CREATE TABLE public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,  -- For HMAC signing
  events TEXT[] NOT NULL,  -- ['stock_out', 'low_stock', etc.]
  is_active BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.webhook_configs(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt_number INTEGER DEFAULT 1,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false
);
```

## 3.3 Key Database Functions

```sql
-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'lab_manager' THEN 3
      WHEN 'operator' THEN 4
      WHEN 'student' THEN 5
      WHEN 'auditor' THEN 6
    END
  LIMIT 1;
$$;

-- Check permission for user
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id 
    AND rp.permission = _permission 
    AND rp.granted = true
  );
$$;

-- Generate unique item code
CREATE OR REPLACE FUNCTION public.generate_item_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'YIMS:ITEM:' || LPAD(floor(random() * 100000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.items WHERE code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Generate unique location code
CREATE OR REPLACE FUNCTION public.generate_location_code(_type location_type)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  type_prefix TEXT;
  code_exists BOOLEAN;
BEGIN
  type_prefix := UPPER(_type::TEXT);
  LOOP
    new_code := 'YIMS:' || type_prefix || ':' || LPAD(floor(random() * 100000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.locations WHERE code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;
```

---

# 4. USER ROLES & PERMISSIONS

## 4.1 Role Hierarchy

| Role | Description | Typical User |
|------|-------------|--------------|
| `super_admin` | Full system access, policies, branding | System Owner |
| `admin` | User management, inventory, reports, approvals | Department Head |
| `lab_manager` | Inventory ops, categories, locations, reports | Lab Supervisor |
| `operator` | Stock operations and reports only | Staff Member |
| `student` | Basic stock operations only | Student Worker |
| `auditor` | Read-only access to logs and reports | External Auditor |

## 4.2 Permission Matrix

| Permission | super_admin | admin | lab_manager | operator | student | auditor |
|------------|:-----------:|:-----:|:-----------:|:--------:|:-------:|:-------:|
| manage_system_policies | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| manage_feature_toggles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| manage_branding | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| manage_users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| manage_roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| view_system_logs | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| manage_inventory | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| manage_categories | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| manage_locations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| perform_stock_operations | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| view_reports | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| manage_approvals | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| export_data | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| import_data | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

## 4.3 First User Behavior

- The first user to sign up automatically receives the `admin` role
- This is handled via a database trigger on the `profiles` table
- Subsequent users get `student` role by default (configurable)

---

# 5. AUTHENTICATION

## 5.1 Username/Password Flow

YIMS uses a custom username-based authentication built on top of Supabase Auth:

```typescript
// Username to email mapping
const email = `${username.toLowerCase()}@yims.local`;

// Sign up
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { username, full_name }
  }
});

// Sign in
await supabase.auth.signInWithPassword({ email, password });
```

### Validation Rules

- **Username**: 3-50 characters, alphanumeric + underscore only
- **Password**: Minimum 6 characters
- **Email**: Auto-generated, not user-facing

## 5.2 Two-Factor Authentication (Optional)

When enabled by admin:

1. User generates TOTP secret via `generate-totp-secret` edge function
2. User scans QR code with authenticator app
3. User verifies code via `verify-totp` edge function
4. Future logins require TOTP code
5. Backup codes available for recovery (8 codes, single-use)

## 5.3 Session & Security

- Session managed by Supabase Auth
- Configurable session timeout (Settings page)
- Failed login attempt tracking
- Account lockout after N failures
- Force password change flag for new admin accounts

## 5.4 Auth Configuration

```typescript
// supabase/config.toml
[auth]
site_url = "https://your-domain.com"
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
enable_confirmations = false  # Auto-confirm for internal use
```

---

# 6. FEATURE SPECIFICATIONS

## 6.1 Dashboard

The main landing page after login:

### Components
- **Welcome Card**: Personalized greeting with user's name
- **Quick Actions**: Large buttons for Stock In, Stock Out, Scan Code
- **Stats Cards**: 
  - Total Items (count)
  - Low Stock Items (items at or below minimum)
  - Total Locations (active locations)
  - Today's Activity (transactions in last 24h)
- **Recent Transactions**: Last 10 transactions with links
- **Analytics Charts** (feature toggle): Stock trends, category distribution

### Quick Start Wizard
- Shown to new users
- Steps: Create Category → Create Location → Add First Item
- Dismissable, remembers state in localStorage

## 6.2 Items Management

### Table Features
- Sortable columns (name, code, stock, category, location)
- Advanced filters:
  - Search (name, code, description)
  - Category (multi-select)
  - Location (multi-select)
  - Stock range (slider)
  - Stock status (all, in_stock, low_stock, out_of_stock)
  - Has variants (yes/no/all)
- Pagination with configurable page size
- Virtual scrolling for large datasets

### Item Operations
- **Create**: Form with all fields, auto-generated code
- **Edit**: Inline editing or modal
- **Clone**: Duplicate item with new code
- **Delete**: Soft delete (is_active = false)
- **Bulk Operations**: Select multiple, batch delete/update

### Item Variants
- Enable "Has Variants" checkbox
- Add variant attributes (size, color, etc.)
- Each variant has own stock count
- Stock operations can target specific variant

### Code Generation
- QR Code display using `qrcode.react`
- Barcode display using `react-barcode`
- Print single or batch print
- Download as image

## 6.3 Categories

Simple CRUD management:
- Name (unique, required)
- Description (optional)
- Item count displayed
- Cannot delete if items exist (show count)

## 6.4 Locations

### Hierarchy Structure
```
Building (YIMS:BUILDING:12345)
└── Room (YIMS:ROOM:23456)
    └── Shelf (YIMS:SHELF:34567)
        └── Box (YIMS:BOX:45678)
            └── Drawer (YIMS:DRAWER:56789)
```

### Features
- Tree view visualization
- Parent-child relationships
- Auto-generated codes by type
- Location path display (Building > Room > Shelf)
- Cannot delete if:
  - Contains items
  - Has child locations

## 6.5 Stock Operations (Action-Based)

**CRITICAL**: Use semantic actions, not generic CRUD.

### The Four Actions

| Action | UI Label | Transaction Type | Description |
|--------|----------|-----------------|-------------|
| Issue | "Issue" | `stock_out` | Give items to someone (expects return) |
| Return | "Return" | `stock_in` | Receive items back |
| Adjust | "Adjust" | `adjustment` | Correct stock discrepancy |
| Consume | "Consume" | `stock_out` | Use items (non-returnable) |

### Action Form Requirements

```typescript
interface StockActionForm {
  itemName: string;       // Read-only display
  currentStock: number;   // Read-only, red if negative
  quantity: number;       // Positive integer
  locationId?: string;    // Optional location selector
  recipient?: string;     // Required for Issue
  projectTag?: string;    // Policy-controlled
  notes?: string;         // Policy-controlled per action type
}
```

### UI Behavior
- Action buttons: 4 large, clearly labeled buttons
- Keyboard shortcuts: 1=Issue, 2=Return, 3=Adjust, 4=Consume
- Quantity confirmation for large amounts (configurable threshold)
- Approval flow triggered for amounts over policy threshold

### Stock Update Flow
```typescript
// Pseudocode for stock operation
const performStockOperation = async (action, quantity, notes) => {
  const item = await getItem(itemId);
  const balanceBefore = item.current_stock;
  
  let balanceAfter;
  let transactionType;
  
  switch (action) {
    case 'issue':
    case 'consume':
      balanceAfter = balanceBefore - quantity;
      transactionType = 'stock_out';
      break;
    case 'return':
      balanceAfter = balanceBefore + quantity;
      transactionType = 'stock_in';
      break;
    case 'adjust':
      balanceAfter = quantity; // Absolute value
      transactionType = 'adjustment';
      break;
  }
  
  // Create immutable transaction record
  await createTransaction({
    item_id: itemId,
    transaction_type: transactionType,
    quantity: Math.abs(balanceAfter - balanceBefore),
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    notes,
    performed_by: currentUser.id
  });
  
  // Update item stock
  await updateItem(itemId, { current_stock: balanceAfter });
};
```

## 6.6 Negative Stock Handling

**CRITICAL**: Negative stock is a first-class state, not an error.

### Visual Indicators
- Red background/badge on stock display
- Warning icon next to number
- Tooltip showing context (who, when, why)

### Tooltip Content
```
Stock went negative on [date] at [time]
By: [username]
Reason: [notes from transaction]
Previous balance: [X]
```

### Admin Configuration (system_policies)
```json
{
  "negative_stock": {
    "allowed": true,
    "max_threshold": -100,
    "autoResolve": true
  }
}
```

### Behavior
- If `allowed: false`, block operations that would go negative
- If `max_threshold` set, warn/block at that limit
- If `autoResolve: true`, create notification when stock returns positive

## 6.7 History & Audit Trail

### Transaction History Page
- Chronological list of all transactions
- Lock icon on each entry (visual indicator of immutability)
- Filters:
  - Date range picker
  - Transaction type (multi-select)
  - User (multi-select)
  - Item search

### Data Displayed
- Timestamp
- Item name + code
- Action type (Issue/Return/Adjust/Consume)
- Quantity change (+/-)
- Balance before → after
- Performed by (username)
- Notes

### Export
- CSV export with all fields
- Date range filtering
- Admin only

## 6.8 Barcode/QR System

### Code Format
```
YIMS:{TYPE}:{ID}
Examples:
- YIMS:ITEM:12345
- YIMS:ROOM:67890
- YIMS:BOX:11111
```

### Code Generator Component
- Display both QR and barcode
- Copy code to clipboard
- Download as PNG
- Print directly

### Batch Code Generator
- Select multiple items
- Generate printable sheet
- Configurable layout (2x4, 3x6, etc.)
- Include item name, code, location

### Scanner Support
- Camera-based scanning (html5-qrcode)
- External barcode scanner (keyboard wedge mode)
- Auto-detect scan vs typing
- Scan logs for audit

## 6.9 Reports

### Available Reports
1. **Low Stock Report**: Items at or below minimum
2. **Transaction Summary**: Totals by type, date range
3. **Inventory Valuation**: Current stock overview
4. **User Activity**: Transactions by user
5. **Location Inventory**: Items by location

### Features
- Date range filtering
- Export to CSV
- Print-friendly view
- Admin/Manager access only

## 6.10 Approvals

### Workflow
1. User initiates large stock operation
2. System checks against threshold (system_policies)
3. If over threshold, create approval_request
4. Notify admins
5. Admin approves/rejects with notes
6. User notified of decision
7. If approved, operation proceeds

### Approval Request Types
- `large_stock_out`: Quantity over threshold
- `new_item`: New item creation (if enabled)
- `item_update`: Significant changes (if enabled)

---

# 7. ADMIN PANEL STRUCTURE

```
Settings Page
├── Preferences (User-specific)
│   ├── Appearance
│   │   ├── Theme (light/dark/system)
│   │   └── Compact Mode (boolean)
│   ├── Notifications
│   │   ├── Toast Notifications (boolean)
│   │   ├── Toast Duration (seconds)
│   │   └── Sound on Scan (boolean)
│   ├── Stock Defaults
│   │   ├── Default Minimum Stock (number)
│   │   ├── Default Unit (string)
│   │   └── Low Stock Warning % (number)
│   └── Display Options
│       ├── Items Per Page (number)
│       ├── Show Item Codes (boolean)
│       └── Show Quick Add Toolbar (boolean)
│
├── System Policies (Admin Only)
│   ├── Negative Stock
│   │   ├── Allowed (boolean)
│   │   ├── Max Threshold (number)
│   │   └── Auto Resolve (boolean)
│   ├── Require Notes
│   │   ├── For Issue (boolean)
│   │   ├── For Return (boolean)
│   │   ├── For Adjust (boolean)
│   │   └── For Consume (boolean)
│   ├── Confirmation Thresholds
│   │   ├── Stock Out Threshold (number)
│   │   └── Adjustment Threshold (number)
│   └── Undo Settings
│       ├── Enabled (boolean)
│       └── Window Minutes (number)
│
├── Feature Toggles (Admin Only)
│   ├── UX Features
│   │   ├── Command Palette
│   │   ├── Analytics Panel
│   │   ├── Undo Transactions
│   │   ├── Keyboard First Mode
│   │   └── Glove Friendly Mode
│   └── Experimental Features
│       ├── Time Travel View
│       ├── Fast Text Parser
│       ├── Live Presence
│       └── Camera QR
│
├── Branding (Admin Only)
│   ├── Logo Upload
│   ├── Favicon Upload
│   ├── App Name
│   ├── Tagline
│   └── Primary Color
│
└── Data & Backup (Admin Only)
    ├── System Health Status
    │   ├── Database Status
    │   ├── Storage Usage
    │   └── Connection Status
    ├── Backup Scheduler
    │   ├── Manual Backup
    │   ├── Auto Backup (daily/weekly/monthly)
    │   ├── Retention Count
    │   └── Backup History
    ├── Data Sharing
    │   ├── Generate Bundle
    │   ├── Include Options
    │   ├── Reason (required)
    │   └── Export History
    └── Offline Mode
        ├── Enable/Disable
        ├── Sync Status
        └── Last Sync Time
```

---

# 8. COMPONENT ARCHITECTURE

## 8.1 Provider Hierarchy

```tsx
<QueryClientProvider client={queryClient}>
  <ThemeProvider defaultTheme="system">
    <OfflineModeProvider>
      <SafeModeProvider>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                {/* App routes */}
              </Routes>
            </BrowserRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </SafeModeProvider>
    </OfflineModeProvider>
  </ThemeProvider>
</QueryClientProvider>
```

## 8.2 Key Components by Category

### Layout Components
| Component | Purpose |
|-----------|---------|
| `AppLayout` | Main shell with sidebar, header, content area |
| `MobileBottomNav` | Bottom navigation for mobile devices |
| `Breadcrumbs` | Path-based navigation display |
| `ProtectedRoute` | Auth + role guard for routes |

### UI Pattern Components
| Component | Purpose |
|-----------|---------|
| `EmptyState` | Consistent empty states with actions |
| `InlineEdit` | Click-to-edit table cells |
| `BulkActionBar` | Floating toolbar for batch operations |
| `SortableHeader` | Clickable column headers for sorting |
| `VirtualTable` | Virtualized rendering for large lists |
| `PullToRefresh` | Mobile pull-to-refresh gesture |

### Inventory Components
| Component | Purpose |
|-----------|---------|
| `ActionButtons` | Issue/Return/Adjust/Consume selector |
| `NegativeStockIndicator` | Visual badge with context tooltip |
| `CodeGenerator` | QR/Barcode display + actions |
| `BatchCodeGenerator` | Multi-item code printing |
| `VariantBuilder` | Item variant management UI |
| `ImageUpload` | Item image upload/preview |

### Filter Components
| Component | Purpose |
|-----------|---------|
| `AdvancedFilters` | Collapsible filter panel |
| `DateRangePicker` | Date range selection |
| `MultiSelect` | Multi-value selection dropdown |
| `StockRangeSlider` | Min-max stock range slider |

### Admin Components
| Component | Purpose |
|-----------|---------|
| `SystemPoliciesSection` | Policy configuration UI |
| `FeatureTogglesSection` | Toggle management UI |
| `BrandingSection` | Logo/styling management |
| `BackupSchedulerSection` | Backup controls + history |
| `DataSharingSection` | Export bundle creator |
| `SystemHealthSection` | Status monitoring dashboard |

### Global Components
| Component | Purpose |
|-----------|---------|
| `GlobalSearch` | Ctrl+K searchable command palette |
| `KeyboardShortcutsDialog` | Shortcut reference modal |
| `SafeModeIndicator` | System health warning banner |
| `SyncIndicator` | Online/offline sync status |
| `OfflineIndicator` | Offline mode badge |
| `NotificationBell` | Notification center trigger |

### Auth Components
| Component | Purpose |
|-----------|---------|
| `TwoFactorSetup` | 2FA configuration wizard |
| `TwoFactorVerify` | 2FA code entry modal |
| `SessionTimeoutWarning` | Session expiry warning |

## 8.3 Custom Hooks

### Authentication & Authorization
| Hook | Purpose |
|------|---------|
| `useAuth` | User state, signIn, signUp, signOut |
| `useRolePermissions` | Permission checking by role |

### Data & Settings
| Hook | Purpose |
|------|---------|
| `useSettings` | App settings (localStorage) |
| `useFeatureToggles` | Feature flag access |
| `useSystemPolicies` | Policy configuration |
| `useBranding` | Branding settings |
| `useNotifications` | In-app notifications |

### Offline & Sync
| Hook | Purpose |
|------|---------|
| `useOfflineMode` | Offline state management |
| `useDataSync` | Sync offline data to cloud |
| `useOfflineItems` | IndexedDB items access |
| `useOfflineCategories` | IndexedDB categories |
| `useOfflineLocations` | IndexedDB locations |
| `useOfflineStock` | IndexedDB transactions |

### UI & Interaction
| Hook | Purpose |
|------|---------|
| `useKeyboardShortcuts` | Global hotkey handling |
| `useBarcodeScanner` | Scanner input detection |
| `useIsMobile` | Responsive breakpoint detection |
| `useCursorPagination` | Cursor-based pagination |
| `useDebouncedCallback` | Debounced function wrapper |
| `useItemSearch` | Item search with debounce |
| `useSessionTimeout` | Session expiry tracking |
| `useQuickStartWizard` | Onboarding state |

---

# 9. OFFLINE-FIRST ARCHITECTURE

## 9.1 IndexedDB Schema (Dexie.js)

```typescript
// src/lib/offlineDb.ts
import Dexie, { Table } from 'dexie';

export interface OfflineCategory {
  id?: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineLocation {
  id?: number;
  code: string;
  name: string;
  locationType: string;
  parentId?: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineItem {
  id?: number;
  code: string;
  name: string;
  description?: string;
  categoryId?: number;
  locationId?: number;
  currentStock: number;
  minimumStock: number;
  unit: string;
  imageUrl?: string;
  hasVariants: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineStockTransaction {
  id?: number;
  itemId: number;
  transactionType: 'stock_in' | 'stock_out' | 'adjustment';
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  recipient?: string;
  performedBy: string;
  createdAt: Date;
}

class YIMSOfflineDatabase extends Dexie {
  categories!: Table<OfflineCategory>;
  locations!: Table<OfflineLocation>;
  items!: Table<OfflineItem>;
  stockTransactions!: Table<OfflineStockTransaction>;

  constructor() {
    super('YIMSOfflineDB');
    
    this.version(1).stores({
      categories: '++id, name, isActive',
      locations: '++id, code, name, locationType, parentId, isActive',
      items: '++id, code, name, categoryId, locationId, currentStock, isActive',
      stockTransactions: '++id, itemId, transactionType, createdAt'
    });
  }
}

export const offlineDb = new YIMSOfflineDatabase();
```

## 9.2 Offline Mode Detection

```typescript
// Automatic detection
const isElectron = navigator.userAgent.includes('Electron');
const isOnline = navigator.onLine;

// Manual toggle (Settings)
const offlineMode = localStorage.getItem('yims-settings')?.offlineMode;
```

## 9.3 Sync Strategy

```typescript
// src/hooks/useDataSync.ts
const syncOrder = ['categories', 'locations', 'items'];

const syncData = async () => {
  for (const table of syncOrder) {
    const offlineData = await offlineDb[table].toArray();
    
    for (const record of offlineData) {
      // Upsert to Supabase
      const { error } = await supabase
        .from(table)
        .upsert(transformForSupabase(record), {
          onConflict: table === 'items' ? 'code' : 'name'
        });
      
      if (error) console.error(`Sync error: ${table}`, error);
    }
  }
  
  localStorage.setItem('yims-last-sync', new Date().toISOString());
};
```

## 9.4 Electron Behavior

When running in Electron:
- Offline mode auto-enabled
- All data persisted in IndexedDB
- Sync available when network detected
- Full functionality without internet

---

# 10. EDGE FUNCTIONS

## 10.1 check-low-stock

Scheduled job to check and notify about low stock:

```typescript
// supabase/functions/check-low-stock/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get items where current_stock <= minimum_stock
  const { data: lowStockItems } = await supabase
    .from('items')
    .select('id, name, code, current_stock, minimum_stock')
    .lte('current_stock', supabase.raw('minimum_stock'))
    .eq('is_active', true);

  // Get admin users
  const { data: admins } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  // Create notifications
  for (const item of lowStockItems || []) {
    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        user_id: admin.user_id,
        title: 'Low Stock Alert',
        message: `${item.name} (${item.code}) is low: ${item.current_stock}/${item.minimum_stock}`,
        type: item.current_stock === 0 ? 'error' : 'warning',
        category: 'stock',
        metadata: { item_id: item.id }
      });
    }
  }

  return new Response(JSON.stringify({ 
    lowStockCount: lowStockItems?.length || 0 
  }));
});
```

## 10.2 generate-totp-secret

Generate TOTP secret for 2FA setup:

```typescript
// supabase/functions/generate-totp-secret/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as OTPAuth from 'https://esm.sh/otpauth@9';

serve(async (req) => {
  // Validate auth
  const authHeader = req.headers.get('Authorization');
  // ... auth validation ...

  // Generate TOTP
  const totp = new OTPAuth.TOTP({
    issuer: 'YIMS',
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret()
  });

  // Generate backup codes
  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.getRandomValues(new Uint32Array(1))[0]
      .toString(16).padStart(8, '0').toUpperCase()
  );

  // Store temporarily in profile
  await supabase.from('profiles').update({
    two_factor_secret: totp.secret.base32,
    backup_codes: backupCodes
  }).eq('user_id', userId);

  return new Response(JSON.stringify({
    secret: totp.secret.base32,
    otpauthUrl: totp.toString(),
    backupCodes
  }));
});
```

## 10.3 verify-totp

Verify TOTP code during login:

```typescript
// supabase/functions/verify-totp/index.ts
import * as OTPAuth from 'https://esm.sh/otpauth@9';

serve(async (req) => {
  const { code, isSetup } = await req.json();

  // Get user's 2FA config
  const { data: profile } = await supabase
    .from('profiles')
    .select('two_factor_secret, backup_codes')
    .eq('user_id', userId)
    .single();

  // Try TOTP validation
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(profile.two_factor_secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  });

  const isValid = totp.validate({ token: code, window: 1 }) !== null;

  if (!isValid && profile.backup_codes?.includes(code)) {
    // Use backup code (remove from list)
    await supabase.from('profiles').update({
      backup_codes: profile.backup_codes.filter(c => c !== code)
    }).eq('user_id', userId);
    
    return new Response(JSON.stringify({ valid: true, usedBackupCode: true }));
  }

  if (isValid && isSetup) {
    // Enable 2FA
    await supabase.from('profiles').update({
      two_factor_enabled: true,
      two_factor_verified_at: new Date().toISOString()
    }).eq('user_id', userId);
  }

  return new Response(JSON.stringify({ valid: isValid }));
});
```

## 10.4 webhook-dispatcher

Dispatch webhooks for system events:

```typescript
// supabase/functions/webhook-dispatcher/index.ts
serve(async (req) => {
  const { event, data } = await req.json();

  // Get active webhooks for this event
  const { data: webhooks } = await supabase
    .from('webhook_configs')
    .select('*')
    .eq('is_active', true)
    .contains('events', [event]);

  for (const webhook of webhooks || []) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    // Optional HMAC signature
    let signature;
    if (webhook.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(webhook.secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)));
      signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
    }

    // Dispatch
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature && { 'X-YIMS-Signature': signature })
      },
      body: JSON.stringify(payload)
    });

    // Log result
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event_type: event,
      payload,
      response_status: response.status,
      success: response.ok
    });
  }
});
```

---

# 11. SAFE MODE

Safe mode activates automatically when critical system failures occur.

## 11.1 Triggers

- Database connection failure
- Storage quota exceeded (>90%)
- Critical function errors
- Multiple consecutive API failures

## 11.2 Behavior

When safe mode is active:
- System switches to **read-only mode**
- Prominent banner displayed at top of screen
- Error details shown in human-readable format
- Emergency data export available
- Stack traces never exposed to users

## 11.3 Implementation

```typescript
// src/contexts/SafeModeContext.tsx
interface SafeModeContextType {
  isSafeMode: boolean;
  errors: SafeModeError[];
  enterSafeMode: (error: SafeModeError) => void;
  exitSafeMode: () => void;
  clearErrorHistory: () => void;
}

interface SafeModeError {
  id: string;
  message: string;
  timestamp: Date;
  type: 'database' | 'storage' | 'network' | 'critical';
}
```

## 11.4 UI

```tsx
// SafeModeIndicator component
{isSafeMode && (
  <Alert variant="destructive" className="m-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Safe Mode Active</AlertTitle>
    <AlertDescription>
      The system has encountered an issue. 
      Data is read-only to prevent corruption.
      <Button onClick={handleEmergencyExport}>
        Export Emergency Backup
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

# 12. UI/UX REQUIREMENTS

## 12.1 Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Ctrl+K` | Open global search | Global |
| `Ctrl+N` | New item | Items page |
| `Ctrl+S` | Save current form | Forms |
| `Escape` | Close dialog/modal | Dialogs |
| `1-4` | Select action type | Stock operations |
| `Enter` | Submit form | Forms |
| `Tab` | Navigate fields | Forms |

## 12.2 Mobile Responsiveness

- **Bottom Navigation**: Replace sidebar with bottom nav on mobile
- **Touch Targets**: Minimum 44x44px for buttons
- **Pull-to-Refresh**: Native gesture support
- **Responsive Tables**: Horizontal scroll or card view
- **Glove Mode**: Larger targets (feature toggle)

## 12.3 Accessibility

- Proper `aria-label` on all interactive elements
- Focus management in modals
- Skip links for keyboard users
- Color contrast WCAG AA compliant
- Screen reader announcements for actions

## 12.4 Loading States

- Skeleton loaders for lists
- Spinner for actions
- Disabled state during submission
- Optimistic updates where safe

## 12.5 Error Handling

- Toast notifications for action results
- Inline validation messages
- Clear error states with recovery actions
- Never expose technical errors to users

---

# 13. PAGES & ROUTES

| Route | Page Component | Access Level |
|-------|---------------|--------------|
| `/` | Dashboard | Authenticated |
| `/auth` | Auth (Login/Signup) | Public |
| `/items` | Items | Authenticated |
| `/categories` | Categories | Authenticated |
| `/locations` | Locations | Authenticated |
| `/stock` | Stock Operations | Authenticated |
| `/scan` | Barcode Scanner | Authenticated |
| `/history` | Transaction History | Authenticated |
| `/import-export` | Data Import/Export | Admin |
| `/users` | User Management | Admin |
| `/logs` | System Logs | Admin |
| `/settings` | Admin Settings | Admin |
| `/reports` | Reports | Admin |
| `/approvals` | Approval Requests | Admin |
| `/about` | About Page | Public |
| `/how-to-use` | Help/Documentation | Public |
| `*` | NotFound (404) | Public |

---

# 14. IMPLEMENTATION PHASES

## Phase 1: Foundation
1. Database schema setup (all tables, enums, functions)
2. RLS policies on all tables
3. Authentication (username/password flow)
4. Basic layout (AppLayout, routing, auth guards)

## Phase 2: Core CRUD
1. Categories management
2. Locations management (hierarchical)
3. Items management (create, edit, delete, list)
4. Item search and filtering
5. Item variants

## Phase 3: Stock Operations
1. Action-based UI (Issue, Return, Adjust, Consume)
2. Transaction logging (immutable)
3. Negative stock handling
4. History page with filters
5. Stock balance calculations

## Phase 4: Admin Panel
1. System policies configuration
2. Feature toggles management
3. Branding customization
4. User management
5. Role permissions

## Phase 5: Reliability
1. Backup scheduler
2. Data sharing bundles
3. Safe mode implementation
4. System health monitoring
5. Error handling improvements

## Phase 6: Offline Support
1. IndexedDB setup (Dexie.js)
2. Offline data hooks
3. Sync mechanism
4. Electron compatibility
5. Offline indicators

## Phase 7: Advanced Features
1. Barcode/QR generation and scanning
2. Batch operations
3. Reports generation
4. Approval workflows
5. Notifications system
6. 2FA support

## Phase 8: Polish
1. Edge functions deployment
2. Webhook integrations
3. Performance optimization
4. Accessibility audit
5. Documentation

---

# 15. SUCCESS CRITERIA

The system is successful when:

### Reliability
- [ ] Users cannot accidentally break workflows
- [ ] System works fully offline (Electron mode)
- [ ] All stock operations are permanently logged
- [ ] Logs cannot be modified or deleted

### Flexibility
- [ ] Admins can adapt behavior without code changes
- [ ] Feature toggles control all experimental features
- [ ] System policies are configurable via UI

### Usability
- [ ] Keyboard-first workflows for power users
- [ ] Mobile-friendly for warehouse scanning
- [ ] UI still makes sense after 1+ year

### Security
- [ ] Role-based access enforced on backend (RLS)
- [ ] Sensitive actions require appropriate roles
- [ ] Audit trail for all administrative changes

### Maintainability
- [ ] Clean component architecture
- [ ] Comprehensive TypeScript types
- [ ] Well-documented code and APIs

---

# APPENDIX A: File Structure

```
src/
├── components/
│   ├── admin/           # Admin-only components
│   ├── auth/            # Authentication components
│   ├── dashboard/       # Dashboard widgets
│   ├── filters/         # Filter components
│   ├── import-export/   # Import/Export sections
│   ├── inventory/       # Inventory-specific
│   ├── layout/          # Layout components
│   ├── onboarding/      # Quick start wizard
│   └── ui/              # shadcn/ui components
├── contexts/
│   ├── AuthContext.tsx
│   ├── OfflineModeContext.tsx
│   └── SafeModeContext.tsx
├── hooks/
│   ├── use*.ts          # All custom hooks
│   └── useOffline*.ts   # Offline data hooks
├── integrations/
│   └── supabase/
│       ├── client.ts    # Auto-generated
│       └── types.ts     # Auto-generated
├── lib/
│   ├── offlineDb.ts     # Dexie database
│   ├── csvUtils.ts      # CSV helpers
│   ├── systemLogger.ts  # Event logging
│   └── utils.ts         # General utilities
├── pages/
│   └── *.tsx            # Route pages
├── types/
│   └── database.ts      # TypeScript types
├── App.tsx
├── index.css            # Tailwind + CSS variables
└── main.tsx

supabase/
├── config.toml          # Supabase config
├── functions/
│   ├── check-low-stock/
│   ├── generate-totp-secret/
│   ├── verify-totp/
│   └── webhook-dispatcher/
└── migrations/          # SQL migrations

docs/
└── YIMS-SPECIFICATION.md  # This file
```

---

# APPENDIX B: Design System

## Colors (HSL in index.css)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --muted: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark variants */
}
```

## Typography

- **Font Family**: System fonts (no custom fonts for reliability)
- **Headings**: Bold, semantic hierarchy (h1-h6)
- **Body**: Regular weight, readable line height

## Spacing

Using Tailwind's default scale (0.25rem increments).

---

# APPENDIX C: Environment Variables

```bash
# .env (auto-generated by Lovable Cloud)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Maintained By**: YIMS Development Team

---

*This specification is designed to be comprehensive enough for any developer or AI assistant to recreate the entire YIMS system from scratch. All design decisions, data structures, and behavioral specifications are documented herein.*
