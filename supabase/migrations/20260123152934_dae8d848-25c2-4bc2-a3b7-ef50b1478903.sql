-- =============================================
-- PHASE 1: SECURITY ENHANCEMENTS
-- =============================================

-- 2FA columns on profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMPTZ;

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identifier, action_type, window_start)
);

-- Enable RLS on rate_limit_logs
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Rate limit policies - service role can manage, no public access needed
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limit_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enhanced audit logging columns
ALTER TABLE public.system_logs
ADD COLUMN IF NOT EXISTS request_id UUID,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS affected_rows INTEGER,
ADD COLUMN IF NOT EXISTS old_values JSONB,
ADD COLUMN IF NOT EXISTS new_values JSONB;

-- =============================================
-- PHASE 2: IN-APP NOTIFICATIONS (replaces email)
-- =============================================

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, error, success
  category TEXT NOT NULL DEFAULT 'system', -- system, stock, approval, webhook
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications(user_id, is_read, created_at DESC);

-- =============================================
-- PHASE 3: PERFORMANCE - FULL TEXT SEARCH
-- =============================================

-- Add search vector column to items
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(code, '')), 'A')
  ) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_items_search ON public.items USING GIN(search_vector);

-- Full-text search function with ranking
CREATE OR REPLACE FUNCTION public.search_items(
  search_query TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  description TEXT,
  category_id UUID,
  location_id UUID,
  current_stock INTEGER,
  minimum_stock INTEGER,
  unit TEXT,
  image_url TEXT,
  has_variants BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  IF search_query IS NULL OR search_query = '' THEN
    RETURN QUERY
    SELECT 
      i.id, i.code, i.name, i.description, i.category_id, i.location_id,
      i.current_stock, i.minimum_stock, i.unit, i.image_url, i.has_variants,
      i.is_active, i.created_at, i.updated_at, 1.0::REAL as rank
    FROM public.items i
    WHERE i.is_active = true
    ORDER BY i.name
    LIMIT p_limit OFFSET p_offset;
  ELSE
    RETURN QUERY
    SELECT 
      i.id, i.code, i.name, i.description, i.category_id, i.location_id,
      i.current_stock, i.minimum_stock, i.unit, i.image_url, i.has_variants,
      i.is_active, i.created_at, i.updated_at,
      ts_rank(i.search_vector, plainto_tsquery('english', search_query)) as rank
    FROM public.items i
    WHERE i.search_vector @@ plainto_tsquery('english', search_query)
      AND i.is_active = true
    ORDER BY rank DESC, i.name
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Cursor-based pagination function
CREATE OR REPLACE FUNCTION public.get_items_paginated(
  p_cursor UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_direction TEXT DEFAULT 'next',
  p_category_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_stock_status TEXT DEFAULT 'all'
)
RETURNS TABLE (
  items JSONB,
  next_cursor UUID,
  prev_cursor UUID,
  has_more BOOLEAN,
  total_count BIGINT
) AS $$
DECLARE
  v_items JSONB;
  v_next_cursor UUID;
  v_prev_cursor UUID;
  v_has_more BOOLEAN;
  v_total BIGINT;
  v_cursor_created_at TIMESTAMPTZ;
BEGIN
  -- Get cursor position
  IF p_cursor IS NOT NULL THEN
    SELECT created_at INTO v_cursor_created_at FROM public.items WHERE id = p_cursor;
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM public.items i
  WHERE i.is_active = true
    AND (p_category_id IS NULL OR i.category_id = p_category_id)
    AND (p_location_id IS NULL OR i.location_id = p_location_id)
    AND (
      p_stock_status = 'all' OR
      (p_stock_status = 'low' AND i.current_stock <= i.minimum_stock AND i.current_stock > 0) OR
      (p_stock_status = 'out' AND i.current_stock = 0) OR
      (p_stock_status = 'ok' AND i.current_stock > i.minimum_stock)
    );

  -- Get items
  SELECT jsonb_agg(row_to_json(t))
  INTO v_items
  FROM (
    SELECT i.*
    FROM public.items i
    WHERE i.is_active = true
      AND (p_category_id IS NULL OR i.category_id = p_category_id)
      AND (p_location_id IS NULL OR i.location_id = p_location_id)
      AND (
        p_stock_status = 'all' OR
        (p_stock_status = 'low' AND i.current_stock <= i.minimum_stock AND i.current_stock > 0) OR
        (p_stock_status = 'out' AND i.current_stock = 0) OR
        (p_stock_status = 'ok' AND i.current_stock > i.minimum_stock)
      )
      AND (
        p_cursor IS NULL OR
        (p_direction = 'next' AND (i.created_at, i.id) < (v_cursor_created_at, p_cursor)) OR
        (p_direction = 'prev' AND (i.created_at, i.id) > (v_cursor_created_at, p_cursor))
      )
    ORDER BY 
      CASE WHEN p_direction = 'next' THEN i.created_at END DESC,
      CASE WHEN p_direction = 'next' THEN i.id END DESC,
      CASE WHEN p_direction = 'prev' THEN i.created_at END ASC,
      CASE WHEN p_direction = 'prev' THEN i.id END ASC
    LIMIT p_limit + 1
  ) t;

  -- Calculate cursors and has_more
  v_has_more := jsonb_array_length(COALESCE(v_items, '[]'::jsonb)) > p_limit;
  
  IF v_has_more THEN
    v_items := v_items - (jsonb_array_length(v_items) - 1);
  END IF;

  IF jsonb_array_length(COALESCE(v_items, '[]'::jsonb)) > 0 THEN
    v_next_cursor := (v_items->-1->>'id')::UUID;
    v_prev_cursor := (v_items->0->>'id')::UUID;
  END IF;

  RETURN QUERY SELECT v_items, v_next_cursor, v_prev_cursor, v_has_more, v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- PHASE 4: WEBHOOK SYSTEM
-- =============================================

-- Webhook configurations table
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt_number INTEGER DEFAULT 1,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Webhook policies - admin only
CREATE POLICY "Admins can manage webhook configs"
  ON public.webhook_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_active ON public.webhook_configs(is_active) WHERE is_active = true;

-- Trigger for webhook_configs updated_at
CREATE TRIGGER update_webhook_configs_updated_at
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- PHASE 5: LOW STOCK CHECK FUNCTION
-- =============================================

-- Function to get low stock items and create notifications
CREATE OR REPLACE FUNCTION public.check_and_notify_low_stock()
RETURNS INTEGER AS $$
DECLARE
  low_stock_count INTEGER := 0;
  admin_users UUID[];
  admin_id UUID;
  item_record RECORD;
BEGIN
  -- Get all admin user IDs
  SELECT ARRAY_AGG(user_id) INTO admin_users
  FROM public.user_roles WHERE role = 'admin';

  -- Find low stock items
  FOR item_record IN
    SELECT id, name, code, current_stock, minimum_stock
    FROM public.items
    WHERE is_active = true
      AND current_stock <= minimum_stock
  LOOP
    low_stock_count := low_stock_count + 1;
    
    -- Create notification for each admin
    FOREACH admin_id IN ARRAY COALESCE(admin_users, ARRAY[]::UUID[])
    LOOP
      -- Check if similar notification exists in last 24 hours
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = admin_id
          AND category = 'stock'
          AND metadata->>'item_id' = item_record.id::TEXT
          AND created_at > now() - interval '24 hours'
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
        VALUES (
          admin_id,
          'Low Stock Alert',
          format('%s (%s) is low on stock: %s/%s', item_record.name, item_record.code, item_record.current_stock, item_record.minimum_stock),
          'warning',
          'stock',
          '/items',
          jsonb_build_object('item_id', item_record.id, 'item_name', item_record.name, 'current_stock', item_record.current_stock, 'minimum_stock', item_record.minimum_stock)
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN low_stock_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;