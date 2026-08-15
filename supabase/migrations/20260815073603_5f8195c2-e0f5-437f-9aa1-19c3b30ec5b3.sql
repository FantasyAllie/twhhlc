CREATE TABLE public.delivery_counts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  template_item_id uuid NOT NULL REFERENCES public.template_items(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  CONSTRAINT delivery_counts_user_hotel_template_item_key UNIQUE (user_id, hotel_id, template_item_id)
);

CREATE INDEX delivery_counts_hotel_id_idx ON public.delivery_counts (hotel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_counts TO authenticated;
GRANT ALL ON public.delivery_counts TO service_role;

ALTER TABLE public.delivery_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access"
ON public.delivery_counts
FOR ALL
TO authenticated
USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))
WITH CHECK (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));

CREATE TRIGGER delivery_counts_set_updated_at
BEFORE UPDATE ON public.delivery_counts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();