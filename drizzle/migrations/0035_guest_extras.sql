-- Guest Extras: each hotel's own complimentary items (water, coffee pods, sweets,
-- wine...) and how many go in a room, by room type, job and number of guests.
-- Not the same as room_extra_items, which is a room's extra linen.
CREATE TABLE public.guest_extras (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
 icon text,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guest_extras_hotel ON public.guest_extras(hotel_id, sort_order);

-- One rule per item and group of room types. quantities[1] is for 1 guest,
-- quantities[2] for 2 guests and so on; each guest past the last adds extra_per_guest.
-- An empty room_types (room_types.value) means every room.
CREATE TABLE public.guest_extra_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 extra_id uuid NOT NULL REFERENCES public.guest_extras(id) ON DELETE CASCADE,
 room_types text[] NOT NULL DEFAULT '{}',
 applies_to text NOT NULL DEFAULT 'arrival' CHECK (applies_to IN ('arrival','stayover','both')),
 quantities integer[] NOT NULL DEFAULT '{1}' CHECK (cardinality(quantities) BETWEEN 1 AND 6 AND 0 <= ALL(quantities) AND 99 >= ALL(quantities)),
 extra_per_guest integer NOT NULL DEFAULT 0 CHECK (extra_per_guest BETWEEN 0 AND 99),
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guest_extra_rules_hotel ON public.guest_extra_rules(hotel_id, extra_id);

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['guest_extras','guest_extra_rules'] LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY "Read %s" ON public.%I FOR SELECT TO authenticated USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))', t, t);
  EXECUTE format('CREATE POLICY "Manage %s" ON public.%I FOR ALL TO authenticated USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),''admin'') OR private.has_role(auth.uid(),''manager'') OR private.has_role(auth.uid(),''regional_admin'') OR private.has_role(auth.uid(),''developer''))) WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),''admin'') OR private.has_role(auth.uid(),''manager'') OR private.has_role(auth.uid(),''regional_admin'') OR private.has_role(auth.uid(),''developer'')))', t, t);
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END IF;
 END LOOP;
END $$;

-- On each room: the extras already left (guest_extras ids), and a guest count set
-- by hand when there's no paperwork. Both are cleared for the next guest.
ALTER TABLE public.rooms ADD COLUMN guest_extras_done jsonb;
ALTER TABLE public.rooms ADD COLUMN guest_extras_guests integer CHECK (guest_extras_guests BETWEEN 1 AND 20);

CREATE OR REPLACE FUNCTION public.clear_guest_extras_for_next_guest() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.sheet_kind IS DISTINCT FROM OLD.sheet_kind
   OR (COALESCE(NEW.guest_vacated,false) AND NOT COALESCE(OLD.guest_vacated,false))
   OR (COALESCE(OLD.done,false) AND NOT COALESCE(NEW.done,false)) THEN
  NEW.guest_extras_done := NULL;
  NEW.guest_extras_guests := NULL;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_clear_guest_extras ON public.rooms;
CREATE TRIGGER trg_clear_guest_extras BEFORE UPDATE OF sheet_kind, guest_vacated, done ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.clear_guest_extras_for_next_guest();

CREATE OR REPLACE FUNCTION public.set_guest_extra_done(p_room_number integer, p_extra uuid, p_done boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hotel uuid := private.current_hotel_id(); v_items jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_hotel) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 IF p_extra IS NULL OR p_done IS NULL OR NOT EXISTS (SELECT 1 FROM public.guest_extras WHERE id=p_extra AND hotel_id=v_hotel) THEN RAISE EXCEPTION 'Extras changed. Please refresh.'; END IF;
 SELECT coalesce(guest_extras_done,'[]'::jsonb) INTO v_items FROM public.rooms WHERE hotel_id=v_hotel AND room_number=p_room_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room is no longer available'; END IF;
 SELECT coalesce(jsonb_agg(DISTINCT e.value),'[]'::jsonb) INTO v_items
  FROM jsonb_array_elements(v_items || CASE WHEN p_done THEN jsonb_build_array(p_extra::text) ELSE '[]'::jsonb END) e
  WHERE e.value <> to_jsonb(p_extra::text) OR p_done;
 UPDATE public.rooms SET guest_extras_done=v_items, updated_at=now() WHERE hotel_id=v_hotel AND room_number=p_room_number;
 RETURN v_items;
END $$;
REVOKE ALL ON FUNCTION public.set_guest_extra_done(integer,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_guest_extra_done(integer,uuid,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_guest_extras_guests(p_room_number integer, p_guests integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hotel uuid := private.current_hotel_id();
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_hotel) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 IF p_guests IS NOT NULL AND (p_guests < 1 OR p_guests > 20) THEN RAISE EXCEPTION 'Guests must be between 1 and 20'; END IF;
 UPDATE public.rooms SET guest_extras_guests=p_guests, updated_at=now() WHERE hotel_id=v_hotel AND room_number=p_room_number;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room is no longer available'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_guest_extras_guests(integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_guest_extras_guests(integer,integer) TO authenticated, service_role;
