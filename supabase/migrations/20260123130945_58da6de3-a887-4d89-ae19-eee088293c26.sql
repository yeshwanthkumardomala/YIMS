-- Fix the permissive system_logs INSERT policy
DROP POLICY IF EXISTS "System can insert logs" ON public.system_logs;

-- Create a more restrictive policy - only authenticated users can insert logs for themselves
CREATE POLICY "Authenticated users can insert their own logs"
    ON public.system_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Create function to handle new user registration (creates profile and assigns default role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_count INTEGER;
BEGIN
    -- Count existing users to determine if this is the first user (admin)
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    
    -- Create profile entry
    INSERT INTO public.profiles (user_id, username, full_name, force_password_change)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        CASE WHEN user_count = 0 THEN false ELSE false END
    );
    
    -- First user gets admin role, others get student role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
        NEW.id,
        CASE WHEN user_count = 0 THEN 'admin'::app_role ELSE 'student'::app_role END
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger to handle new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow profiles to be inserted by the trigger (service role)
CREATE POLICY "Service role can insert profiles"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);