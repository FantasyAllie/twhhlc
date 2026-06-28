
ALTER TABLE public.room_types ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.room_features ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.reception_items ADD COLUMN IF NOT EXISTS sort_order integer;

UPDATE public.room_types t SET sort_order = sub.rn
FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS rn FROM public.room_types) sub
WHERE t.id = sub.id AND t.sort_order IS NULL;

UPDATE public.room_features t SET sort_order = sub.rn
FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS rn FROM public.room_features) sub
WHERE t.id = sub.id AND t.sort_order IS NULL;

UPDATE public.reception_items t SET sort_order = sub.rn
FROM (SELECT id, row_number() OVER (PARTITION BY user_id, kind ORDER BY created_at) AS rn FROM public.reception_items) sub
WHERE t.id = sub.id AND t.sort_order IS NULL;
