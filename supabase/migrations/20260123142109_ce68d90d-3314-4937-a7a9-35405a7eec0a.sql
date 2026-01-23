-- =============================================
-- Phase 1: Database Schema Updates for YIMS
-- =============================================

-- 1. Add has_variants column to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;

-- 2. Create item_variants table for size/color variations
CREATE TABLE public.item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  variant_attributes JSONB NOT NULL DEFAULT '{}',
  sku_suffix TEXT,
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on item_variants
ALTER TABLE public.item_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for item_variants
CREATE POLICY "Authenticated users can view active variants"
ON public.item_variants FOR SELECT
USING ((is_active = true) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin and operators can manage variants"
ON public.item_variants FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Trigger for updated_at on item_variants
CREATE TRIGGER update_item_variants_updated_at
BEFORE UPDATE ON public.item_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create approval_requests table for workflow
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('large_stock_out', 'new_item', 'item_update')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.item_variants(id) ON DELETE SET NULL,
  quantity INTEGER,
  threshold_exceeded INTEGER,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on approval_requests
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for approval_requests
CREATE POLICY "Users can view their own requests"
ON public.approval_requests FOR SELECT
USING (requested_by = auth.uid());

CREATE POLICY "Admins can view all requests"
ON public.approval_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can create requests"
ON public.approval_requests FOR INSERT
WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admins can update requests"
ON public.approval_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create app_settings table for system configuration
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_settings
CREATE POLICY "Authenticated users can view settings"
ON public.app_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.app_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
('stock_out_approval_threshold', '50', 'Stock-out quantities above this require admin approval'),
('new_item_requires_approval', 'false', 'Whether new item creation requires admin approval'),
('low_stock_alert_enabled', 'true', 'Show low stock alerts on dashboard');

-- 5. Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-images',
  'item-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for item-images bucket
CREATE POLICY "Anyone can view item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can upload item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'item-images');

CREATE POLICY "Admins and operators can delete item images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'item-images' AND (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operator'::app_role)
));

CREATE POLICY "Admins and operators can update item images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'item-images' AND (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operator'::app_role)
));