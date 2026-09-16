CREATE TABLE public.room_preferred_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_number integer NOT NULL,
  template_item_id uuid NOT NULL REFERENCES public.template_items(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, room_number, template_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_preferred_items TO authenticated;
GRANT ALL ON public.room_preferred_items TO service_role;

ALTER TABLE public.room_preferred_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access"
ON public.room_preferred_items
FOR ALL
TO authenticated
USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))
WITH CHECK (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));