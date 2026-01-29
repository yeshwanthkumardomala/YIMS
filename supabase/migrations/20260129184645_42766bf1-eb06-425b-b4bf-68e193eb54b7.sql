-- Create table to store Google OAuth tokens (encrypted)
CREATE TABLE public.google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  token_type text DEFAULT 'Bearer',
  expires_at timestamp with time zone,
  scope text,
  connected_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can manage tokens
CREATE POLICY "Admins can manage google oauth tokens"
ON public.google_oauth_tokens
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_google_oauth_tokens_updated_at
BEFORE UPDATE ON public.google_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Store last export info
CREATE TABLE public.google_sheets_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  spreadsheet_id text NOT NULL,
  spreadsheet_url text NOT NULL,
  spreadsheet_name text NOT NULL,
  exported_at timestamp with time zone NOT NULL DEFAULT now(),
  export_type text NOT NULL DEFAULT 'full', -- 'full' or 'incremental'
  record_counts jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_sheets_exports ENABLE ROW LEVEL SECURITY;

-- Admins can view and create exports
CREATE POLICY "Admins can manage google sheets exports"
ON public.google_sheets_exports
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));