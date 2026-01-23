-- Phase 2: Branding Settings Table (stores URLs only, not files)
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

-- Enable RLS
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view branding"
ON public.branding_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage branding"
ON public.branding_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default branding row
INSERT INTO public.branding_settings (app_name, tagline) VALUES ('YIMS', 'Yesh Inventory Management System');

-- Add trigger for updated_at
CREATE TRIGGER update_branding_settings_updated_at
BEFORE UPDATE ON public.branding_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true);

-- Storage policies for branding bucket
CREATE POLICY "Anyone can view branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

CREATE POLICY "Admins can upload branding assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update branding assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branding assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));