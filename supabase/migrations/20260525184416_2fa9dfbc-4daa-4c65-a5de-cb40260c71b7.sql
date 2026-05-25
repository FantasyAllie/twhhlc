-- Update existing super_king_twin data before changing constraints
UPDATE public.template_items SET category = 'super_king' WHERE category = 'super_king_twin';
UPDATE public.rooms SET category = 'super_king' WHERE category = 'super_king_twin';

-- Drop old check constraints
ALTER TABLE public.template_items DROP CONSTRAINT IF EXISTS template_items_category_check;
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_category_check;

-- Add new check constraints with only double and super_king
ALTER TABLE public.template_items ADD CONSTRAINT template_items_category_check CHECK (category = ANY (ARRAY['double'::text, 'super_king'::text]));
ALTER TABLE public.rooms ADD CONSTRAINT rooms_category_check CHECK (category = ANY (ARRAY['double'::text, 'super_king'::text]));