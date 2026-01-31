-- Create function to get the primary admin ID (first admin by granted_at)
CREATE OR REPLACE FUNCTION get_primary_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id 
  FROM user_roles 
  WHERE role = 'admin' 
  ORDER BY granted_at ASC 
  LIMIT 1
$$;

-- Create function to check if a user is the primary admin
CREATE OR REPLACE FUNCTION is_primary_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = get_primary_admin_id()
$$;