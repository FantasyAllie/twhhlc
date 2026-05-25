
ALTER TABLE public.template_items ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'double' CHECK (category IN ('double','super_king','super_king_twin'));
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('double','super_king','super_king_twin'));
