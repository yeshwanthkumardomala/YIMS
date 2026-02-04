-- Add custom type label column to locations table
ALTER TABLE public.locations
ADD COLUMN custom_type_label TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.locations.custom_type_label IS 'Optional custom label when the predefined location types are not sufficient';