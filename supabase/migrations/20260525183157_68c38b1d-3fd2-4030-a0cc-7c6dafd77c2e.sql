
ALTER TABLE public.template_items ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
-- Seed positions per category by created_at so existing items get a stable order
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY category ORDER BY created_at) AS rn
  FROM public.template_items
)
UPDATE public.template_items t SET position = o.rn FROM ordered o WHERE t.id = o.id;
