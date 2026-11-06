-- Room pins, part two: developer accounts show by name only, and each hotel
-- chooses which departments use room pins (F&B, which isn't room-based, is
-- off unless the hotel turns it on).

-- Developer accounts sit in every department, so their pins show the name alone.
CREATE OR REPLACE FUNCTION public.assign_room_pin_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
  NEW.created_by := auth.uid();
  SELECT coalesce(nullif(display_name,''), nullif(split_part(email,'@',1),''), 'Staff') INTO NEW.created_by_name FROM public.profiles WHERE id = auth.uid();
  NEW.created_by_name := coalesce(NEW.created_by_name, 'Staff');
  NEW.created_by_departments := CASE WHEN private.has_role(auth.uid(), 'developer') THEN '{}'::text[] ELSE private.user_departments(auth.uid()) END;
 END IF;
 NEW.created_at := now();
 IF TG_TABLE_NAME = 'room_pins' THEN
  NEW.status := 'open'; NEW.resolved_by_name := NULL; NEW.resolved_at := NULL;
  NEW.last_reply_at := NULL; NEW.sender_seen_at := now();
 END IF;
 RETURN NEW;
END $$;

UPDATE public.room_pins p SET created_by_departments = '{}'
 WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.created_by AND r.role = 'developer');
UPDATE public.room_pin_replies p SET created_by_departments = '{}'
 WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.created_by AND r.role = 'developer');

-- Which departments a hotel's pins can be for. No row means the default.
CREATE TABLE public.room_pin_settings (
 hotel_id uuid PRIMARY KEY DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 departments text[] NOT NULL DEFAULT '{housekeeping,reception,maintenance}'
  CHECK (departments <@ ARRAY['housekeeping','reception','fnb','maintenance']::text[]),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.room_pin_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_pin_settings FROM anon;
REVOKE ALL ON public.room_pin_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.room_pin_settings TO authenticated;
GRANT ALL ON public.room_pin_settings TO service_role;
CREATE POLICY "Read room_pin_settings" ON public.room_pin_settings FOR SELECT TO authenticated
 USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "Add room_pin_settings" ON public.room_pin_settings FOR INSERT TO authenticated
 WITH CHECK (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()));
CREATE POLICY "Change room_pin_settings" ON public.room_pin_settings FOR UPDATE TO authenticated
 USING (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()))
 WITH CHECK (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()));
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='room_pin_settings') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_pin_settings;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION private.pin_departments(_hotel_id uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce((SELECT departments FROM public.room_pin_settings WHERE hotel_id = _hotel_id), '{housekeeping,reception,maintenance}'::text[]);
$$;
REVOKE ALL ON FUNCTION private.pin_departments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pin_departments(uuid) TO authenticated, service_role;

-- New pins can only be for a department the hotel uses.
DROP POLICY IF EXISTS "Add room pins" ON public.room_pins;
CREATE POLICY "Add room pins" ON public.room_pins FOR INSERT TO authenticated WITH CHECK (
 private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id)
 AND to_department = ANY(private.pin_departments(hotel_id))
 AND EXISTS (SELECT 1 FROM public.rooms r WHERE r.hotel_id = room_pins.hotel_id AND r.room_number = room_pins.room_number));
