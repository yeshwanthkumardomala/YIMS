-- Phase 1: Feature Toggles Table
CREATE TABLE public.feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  category TEXT DEFAULT 'experimental',
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feature_toggles ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can view, only admins can update
CREATE POLICY "Authenticated users can view feature toggles"
ON public.feature_toggles
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage feature toggles"
ON public.feature_toggles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default toggles (all OFF per spec)
INSERT INTO public.feature_toggles (key, enabled, description, category) VALUES
  ('command_palette', false, 'Enable Ctrl+K command palette for quick navigation', 'ux'),
  ('time_travel_view', false, 'View inventory state at past dates', 'experimental'),
  ('fast_text_parser', false, 'Parse text input for quick item entry', 'experimental'),
  ('live_presence', false, 'Show other users currently online', 'experimental'),
  ('analytics_panel', false, 'Show analytics charts on dashboard', 'ux'),
  ('camera_qr', false, 'Enable camera-based QR/barcode scanning', 'experimental'),
  ('undo_transactions', false, 'Allow undoing recent transactions', 'ux'),
  ('keyboard_first_mode', false, 'Optimize UI for keyboard navigation', 'ux'),
  ('glove_friendly_mode', false, 'Larger touch targets for glove use', 'ux');

-- Add trigger for updated_at
CREATE TRIGGER update_feature_toggles_updated_at
BEFORE UPDATE ON public.feature_toggles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 1: System Policies Table (admin-configurable inventory rules)
CREATE TABLE public.system_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_policies ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view system policies"
ON public.system_policies
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage system policies"
ON public.system_policies
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default policies
INSERT INTO public.system_policies (key, value, description) VALUES
  ('negative_stock', '{"allowed": true, "max_threshold": -100, "auto_resolve": true}', 'Negative stock handling rules'),
  ('require_reason', '{"issue": true, "consume": true, "adjust": false, "return": false}', 'Require reason/notes for actions'),
  ('require_project_tag', '{"enabled": false, "actions": ["issue", "consume"]}', 'Require project tag for actions'),
  ('undo_settings', '{"enabled": false, "window_minutes": 15}', 'Undo transaction settings'),
  ('confirmation_thresholds', '{"stock_out": 50, "adjust": 100}', 'Quantity thresholds requiring confirmation');

-- Add trigger for updated_at
CREATE TRIGGER update_system_policies_updated_at
BEFORE UPDATE ON public.system_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();