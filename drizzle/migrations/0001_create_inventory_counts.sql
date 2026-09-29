CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('room','cupboard')),
  location text NOT NULL,
  template_item_id uuid NOT NULL REFERENCES public.template_items(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_counts_unique UNIQUE (hotel_id, section, location, template_item_id)
);
CREATE INDEX inventory_counts_hotel_idx ON public.inventory_counts (hotel_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON public.inventory_counts
FOR ALL TO authenticated
USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))
WITH CHECK (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE TRIGGER inventory_counts_set_updated_at BEFORE UPDATE ON public.inventory_counts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_counts;