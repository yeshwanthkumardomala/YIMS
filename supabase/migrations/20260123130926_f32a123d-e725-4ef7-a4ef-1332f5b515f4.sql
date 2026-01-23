-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'student');

-- Create location_type enum for location hierarchy
CREATE TYPE public.location_type AS ENUM ('building', 'room', 'shelf', 'box', 'drawer');

-- Create transaction_type enum for stock operations
CREATE TYPE public.transaction_type AS ENUM ('stock_in', 'stock_out', 'adjustment');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    force_password_change BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create categories table for item categorization
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create locations table with hierarchy support
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location_type location_type NOT NULL,
    parent_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create items table
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.categories(id),
    location_id UUID REFERENCES public.locations(id),
    current_stock INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'pcs',
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create stock_transactions table (append-only audit log)
CREATE TABLE public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    transaction_type transaction_type NOT NULL,
    quantity INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    location_id UUID REFERENCES public.locations(id),
    notes TEXT,
    recipient TEXT,
    performed_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create usage_history table (append-only)
CREATE TABLE public.usage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    quantity INTEGER NOT NULL,
    purpose TEXT,
    used_by UUID REFERENCES auth.users(id) NOT NULL,
    recorded_by UUID REFERENCES auth.users(id) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scan_logs table for barcode scanning activity
CREATE TABLE public.scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_scanned TEXT NOT NULL,
    code_type TEXT,
    item_id UUID REFERENCES public.items(id),
    location_id UUID REFERENCES public.locations(id),
    scanned_by UUID REFERENCES auth.users(id) NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create system_logs table for audit trail
CREATE TABLE public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_description TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY 
        CASE role 
            WHEN 'admin' THEN 1 
            WHEN 'operator' THEN 2 
            WHEN 'student' THEN 3 
        END
    LIMIT 1
$$;

-- Create function to generate item codes
CREATE OR REPLACE FUNCTION public.generate_item_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := 'YIMS:ITEM:' || LPAD(floor(random() * 100000)::text, 5, '0');
        SELECT EXISTS(SELECT 1 FROM public.items WHERE code = new_code) INTO code_exists;
        EXIT WHEN NOT code_exists;
    END LOOP;
    RETURN new_code;
END;
$$;

-- Create function to generate location codes
CREATE OR REPLACE FUNCTION public.generate_location_code(_type location_type)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    type_prefix TEXT;
BEGIN
    type_prefix := UPPER(_type::text);
    LOOP
        new_code := 'YIMS:' || type_prefix || ':' || LPAD(floor(random() * 100000)::text, 5, '0');
        SELECT EXISTS(SELECT 1 FROM public.locations WHERE code = new_code) INTO code_exists;
        EXIT WHEN NOT code_exists;
    END LOOP;
    RETURN new_code;
END;
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles (admin only management)
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
    ON public.user_roles FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
    ON public.user_roles FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for categories (authenticated can read, admin/operator can write)
CREATE POLICY "Authenticated users can view categories"
    ON public.categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admin and operators can manage categories"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- RLS Policies for locations (authenticated can read, admin/operator can write)
CREATE POLICY "Authenticated users can view active locations"
    ON public.locations FOR SELECT
    TO authenticated
    USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin and operators can manage locations"
    ON public.locations FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- RLS Policies for items (authenticated can read, admin/operator can write)
CREATE POLICY "Authenticated users can view active items"
    ON public.items FOR SELECT
    TO authenticated
    USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin and operators can manage items"
    ON public.items FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- RLS Policies for stock_transactions (authenticated can read own, admin/operator can write)
CREATE POLICY "Users can view transactions they performed"
    ON public.stock_transactions FOR SELECT
    TO authenticated
    USING (performed_by = auth.uid());

CREATE POLICY "Admin and operators can view all transactions"
    ON public.stock_transactions FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Authenticated users can insert transactions"
    ON public.stock_transactions FOR INSERT
    TO authenticated
    WITH CHECK (performed_by = auth.uid());

-- RLS Policies for usage_history
CREATE POLICY "Users can view their usage history"
    ON public.usage_history FOR SELECT
    TO authenticated
    USING (used_by = auth.uid() OR recorded_by = auth.uid());

CREATE POLICY "Admin and operators can view all usage history"
    ON public.usage_history FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Authenticated users can insert usage history"
    ON public.usage_history FOR INSERT
    TO authenticated
    WITH CHECK (recorded_by = auth.uid());

-- RLS Policies for scan_logs
CREATE POLICY "Users can view their scan logs"
    ON public.scan_logs FOR SELECT
    TO authenticated
    USING (scanned_by = auth.uid());

CREATE POLICY "Admin can view all scan logs"
    ON public.scan_logs FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert scan logs"
    ON public.scan_logs FOR INSERT
    TO authenticated
    WITH CHECK (scanned_by = auth.uid());

-- RLS Policies for system_logs (admin only)
CREATE POLICY "Admin can view system logs"
    ON public.system_logs FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs"
    ON public.system_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_items_category ON public.items(category_id);
CREATE INDEX idx_items_location ON public.items(location_id);
CREATE INDEX idx_items_code ON public.items(code);
CREATE INDEX idx_locations_parent ON public.locations(parent_id);
CREATE INDEX idx_locations_type ON public.locations(location_type);
CREATE INDEX idx_stock_transactions_item ON public.stock_transactions(item_id);
CREATE INDEX idx_stock_transactions_date ON public.stock_transactions(created_at);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_system_logs_user ON public.system_logs(user_id);
CREATE INDEX idx_system_logs_type ON public.system_logs(event_type);