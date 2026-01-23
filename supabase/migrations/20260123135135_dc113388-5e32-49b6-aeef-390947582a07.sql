-- Add color and icon columns to categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1',
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'package',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Create trigger for automatic timestamp updates on categories
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();