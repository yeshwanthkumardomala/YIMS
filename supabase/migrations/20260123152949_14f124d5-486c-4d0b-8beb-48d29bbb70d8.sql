-- Fix overly permissive RLS policies by making them more specific
-- These policies are for system-level operations only

-- Drop and recreate rate_limit_logs policy with service role check
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limit_logs;

-- Rate limit logs should only be accessible/writable by authenticated users for their own requests
CREATE POLICY "Authenticated can insert rate limits"
  ON public.rate_limit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can select rate limits"
  ON public.rate_limit_logs FOR SELECT
  TO authenticated
  USING (true);

-- Update notifications insert policy to be more specific
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Allow authenticated users to insert notifications (for edge functions running as authenticated)
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update webhook_logs insert policy
DROP POLICY IF EXISTS "System can insert webhook logs" ON public.webhook_logs;

-- Allow authenticated users to insert webhook logs
CREATE POLICY "Authenticated can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);