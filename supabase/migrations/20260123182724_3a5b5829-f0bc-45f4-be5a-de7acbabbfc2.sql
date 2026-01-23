-- Phase 3b: Create role permissions table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view role permissions"
ON public.role_permissions
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Insert default permissions for each role
-- Super Admin: full access
INSERT INTO public.role_permissions (role, permission) VALUES
  ('super_admin', 'manage_system_policies'),
  ('super_admin', 'manage_feature_toggles'),
  ('super_admin', 'manage_branding'),
  ('super_admin', 'manage_users'),
  ('super_admin', 'manage_roles'),
  ('super_admin', 'view_system_logs'),
  ('super_admin', 'manage_inventory'),
  ('super_admin', 'manage_categories'),
  ('super_admin', 'manage_locations'),
  ('super_admin', 'perform_stock_operations'),
  ('super_admin', 'view_reports'),
  ('super_admin', 'manage_approvals'),
  ('super_admin', 'export_data'),
  ('super_admin', 'import_data');

-- Admin: most access except system policies
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'manage_users'),
  ('admin', 'manage_roles'),
  ('admin', 'view_system_logs'),
  ('admin', 'manage_inventory'),
  ('admin', 'manage_categories'),
  ('admin', 'manage_locations'),
  ('admin', 'perform_stock_operations'),
  ('admin', 'view_reports'),
  ('admin', 'manage_approvals'),
  ('admin', 'export_data'),
  ('admin', 'import_data');

-- Lab Manager: inventory and reports
INSERT INTO public.role_permissions (role, permission) VALUES
  ('lab_manager', 'manage_inventory'),
  ('lab_manager', 'manage_categories'),
  ('lab_manager', 'manage_locations'),
  ('lab_manager', 'perform_stock_operations'),
  ('lab_manager', 'view_reports'),
  ('lab_manager', 'export_data');

-- Operator: stock operations only
INSERT INTO public.role_permissions (role, permission) VALUES
  ('operator', 'perform_stock_operations'),
  ('operator', 'view_reports');

-- Student: view and basic stock operations
INSERT INTO public.role_permissions (role, permission) VALUES
  ('student', 'perform_stock_operations');

-- Auditor: read-only access to all data
INSERT INTO public.role_permissions (role, permission) VALUES
  ('auditor', 'view_system_logs'),
  ('auditor', 'view_reports'),
  ('auditor', 'export_data');

-- Create helper function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.permission = _permission
      AND rp.granted = true
  )
$$;