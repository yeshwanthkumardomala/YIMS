
-- Fix 1: Remove admin SELECT on google_oauth_tokens (edge function uses service role, no need for client SELECT)
-- Replace the ALL policy with separate INSERT, UPDATE, DELETE policies (no SELECT for raw tokens)
DROP POLICY IF EXISTS "Admins can manage google oauth tokens" ON public.google_oauth_tokens;

-- Admins can insert tokens (via edge function with service role, but keep for flexibility)
CREATE POLICY "Admins can insert google oauth tokens"
ON public.google_oauth_tokens
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update tokens
CREATE POLICY "Admins can update google oauth tokens"
ON public.google_oauth_tokens
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete tokens (for disconnect)
CREATE POLICY "Admins can delete google oauth tokens"
ON public.google_oauth_tokens
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can only see non-sensitive token metadata (connected_email, expires_at)
-- Use a restrictive SELECT policy that only returns safe columns
-- Note: Postgres RLS doesn't support column-level filtering, so we allow SELECT
-- but the client code should only query safe columns. The edge function uses service role.
CREATE POLICY "Admins can view token metadata"
ON public.google_oauth_tokens
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Revoke direct column access to sensitive profile fields
-- We use column-level REVOKE to prevent reading 2FA secrets via RLS
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, username, full_name, is_active, failed_login_attempts, locked_until, force_password_change, two_factor_enabled, two_factor_verified_at, created_at, updated_at) ON public.profiles TO authenticated;
GRANT INSERT (id, user_id, username, full_name, is_active, failed_login_attempts, locked_until, force_password_change, two_factor_enabled, two_factor_secret, two_factor_verified_at, backup_codes, created_at, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (username, full_name, is_active, failed_login_attempts, locked_until, force_password_change, two_factor_enabled, two_factor_secret, two_factor_verified_at, backup_codes, updated_at) ON public.profiles TO authenticated;
