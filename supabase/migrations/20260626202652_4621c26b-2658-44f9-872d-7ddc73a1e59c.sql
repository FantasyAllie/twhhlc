ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS sort_order integer;
UPDATE public.rooms SET sort_order = room_number WHERE sort_order IS NULL;
ALTER TABLE public.rooms ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN sort_order SET DEFAULT 0;
CREATE INDEX IF NOT EXISTS rooms_user_sort_idx ON public.rooms(user_id, sort_order);