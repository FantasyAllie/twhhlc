CREATE TABLE public.maintenance_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  sort_order integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_areas TO authenticated;
GRANT ALL ON public.maintenance_areas TO service_role;
ALTER TABLE public.maintenance_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON public.maintenance_areas FOR ALL TO authenticated
  USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))
  WITH CHECK (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));

ALTER TABLE public.maintenance_requests ALTER COLUMN room_number DROP NOT NULL;
ALTER TABLE public.maintenance_requests ADD COLUMN IF NOT EXISTS area_label text;