CREATE TABLE public.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  colour text NOT NULL DEFAULT '#6D5BD0' CHECK (colour ~ '^#[0-9A-Fa-f]{6}$'),
  owner_department text CHECK (owner_department IN ('housekeeping','reception','fnb','maintenance')),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendars_hotel ON public.calendars(hotel_id, sort_order);

CREATE TABLE public.calendar_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  department text CHECK (department IN ('housekeeping','reception','fnb','maintenance')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit boolean NOT NULL DEFAULT false,
  CHECK ((department IS NULL) <> (user_id IS NULL))
);
CREATE UNIQUE INDEX calendar_shares_department ON public.calendar_shares(calendar_id, department) WHERE department IS NOT NULL;
CREATE UNIQUE INDEX calendar_shares_user ON public.calendar_shares(calendar_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX calendar_shares_user_lookup ON public.calendar_shares(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 200),
  room_number integer,
  all_day boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  rrule text CHECK (rrule IS NULL OR (char_length(rrule) <= 500 AND rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Za-z0-9,+:-]+)*$')),
  repeat_until timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT 'Staff',
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at)
);
CREATE INDEX calendar_events_range ON public.calendar_events(calendar_id, starts_at);
CREATE INDEX calendar_events_hotel ON public.calendar_events(hotel_id, starts_at);

CREATE TABLE public.calendar_event_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  occurrence_start timestamptz NOT NULL,
  cancelled boolean NOT NULL DEFAULT false,
  title text CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 200),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 5000),
  location text CHECK (location IS NULL OR char_length(location) <= 200),
  all_day boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, occurrence_start),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);

REVOKE ALL ON public.calendars FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.calendars FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendars TO authenticated;
GRANT ALL ON public.calendars TO service_role;
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_shares FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.calendar_shares FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_shares TO authenticated;
GRANT ALL ON public.calendar_shares TO service_role;
ALTER TABLE public.calendar_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_events FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.calendar_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_event_exceptions FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.calendar_event_exceptions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_exceptions TO authenticated;
GRANT ALL ON public.calendar_event_exceptions TO service_role;
ALTER TABLE public.calendar_event_exceptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.calendar_access(_calendar_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN c.id IS NULL OR NOT private.has_module(c.hotel_id, 'calendar') THEN NULL
    WHEN private.is_admin_or_manager(auth.uid()) THEN 'edit'
    WHEN c.owner_department = ANY (private.user_departments(auth.uid())) THEN 'edit'
    WHEN EXISTS (SELECT 1 FROM public.calendar_shares s WHERE s.calendar_id = c.id AND s.can_edit
                 AND (s.user_id = auth.uid() OR s.department = ANY (private.user_departments(auth.uid())))) THEN 'edit'
    WHEN EXISTS (SELECT 1 FROM public.calendar_shares s WHERE s.calendar_id = c.id
                 AND (s.user_id = auth.uid() OR s.department = ANY (private.user_departments(auth.uid())))) THEN 'view'
    ELSE NULL
  END
  FROM (SELECT NULL::int) one
  LEFT JOIN public.calendars c ON c.id = _calendar_id;
$$;

CREATE OR REPLACE FUNCTION private.can_view_calendar(_calendar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.calendar_access(_calendar_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION private.can_edit_calendar(_calendar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.calendar_access(_calendar_id) = 'edit';
$$;

CREATE OR REPLACE FUNCTION private.event_calendar(_event_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT calendar_id FROM public.calendar_events WHERE id = _event_id;
$$;
REVOKE ALL ON FUNCTION private.calendar_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.calendar_access(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.can_view_calendar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_view_calendar(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.can_edit_calendar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_edit_calendar(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.event_calendar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.event_calendar(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.split_calendar_event(
  p_event uuid,
  p_version integer,
  p_old_rrule text,
  p_old_repeat_until timestamptz,
  p_from timestamptz,
  p_new jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _new uuid;
BEGIN
  UPDATE public.calendar_events
     SET rrule = p_old_rrule, repeat_until = p_old_repeat_until
   WHERE id = p_event AND version = p_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Someone else changed this event. Please try again.' USING ERRCODE = '40001';
  END IF;
  DELETE FROM public.calendar_event_exceptions WHERE event_id = p_event AND occurrence_start >= p_from;
  INSERT INTO public.calendar_events (calendar_id, title, notes, location, room_number, all_day,
                                      starts_at, ends_at, timezone, rrule, repeat_until)
  VALUES ((p_new->>'calendar_id')::uuid, p_new->>'title', coalesce(p_new->>'notes', ''),
          coalesce(p_new->>'location', ''), (p_new->>'room_number')::int,
          coalesce((p_new->>'all_day')::boolean, false),
          (p_new->>'starts_at')::timestamptz, (p_new->>'ends_at')::timestamptz,
          p_new->>'timezone', p_new->>'rrule',
          (p_new->>'repeat_until')::timestamptz)
  RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.split_calendar_event(uuid, integer, text, timestamptz, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.split_calendar_event(uuid, integer, text, timestamptz, timestamptz, jsonb) TO authenticated, service_role;

CREATE POLICY "calendars read" ON public.calendars FOR SELECT TO authenticated USING (private.can_view_calendar(id));
CREATE POLICY "calendars add" ON public.calendars FOR INSERT TO authenticated WITH CHECK (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY "calendars change" ON public.calendars FOR UPDATE TO authenticated USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role)))) WITH CHECK (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY "calendars delete" ON public.calendars FOR DELETE TO authenticated USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));

CREATE POLICY "calendar shares read" ON public.calendar_shares FOR SELECT TO authenticated USING (private.can_view_calendar(calendar_id));
CREATE POLICY "calendar shares add" ON public.calendar_shares FOR INSERT TO authenticated WITH CHECK ((private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role)))) AND (user_id IS NULL OR EXISTS (SELECT 1 FROM public.hotel_members hm WHERE hm.user_id = calendar_shares.user_id AND hm.hotel_id = calendar_shares.hotel_id)));
CREATE POLICY "calendar shares change" ON public.calendar_shares FOR UPDATE TO authenticated USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role)))) WITH CHECK ((private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role)))) AND (user_id IS NULL OR EXISTS (SELECT 1 FROM public.hotel_members hm WHERE hm.user_id = calendar_shares.user_id AND hm.hotel_id = calendar_shares.hotel_id)));
CREATE POLICY "calendar shares delete" ON public.calendar_shares FOR DELETE TO authenticated USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'calendar') AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));

CREATE POLICY "calendar events read" ON public.calendar_events FOR SELECT TO authenticated USING (private.can_view_calendar(calendar_id));
CREATE POLICY "calendar events add" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (private.can_edit_calendar(calendar_id));
CREATE POLICY "calendar events change" ON public.calendar_events FOR UPDATE TO authenticated USING (private.can_edit_calendar(calendar_id)) WITH CHECK (private.can_edit_calendar(calendar_id));
CREATE POLICY "calendar events delete" ON public.calendar_events FOR DELETE TO authenticated USING (private.can_edit_calendar(calendar_id));

CREATE POLICY "calendar exceptions read" ON public.calendar_event_exceptions FOR SELECT TO authenticated USING (private.can_view_calendar(private.event_calendar(event_id)));
CREATE POLICY "calendar exceptions add" ON public.calendar_event_exceptions FOR INSERT TO authenticated WITH CHECK (private.can_edit_calendar(private.event_calendar(event_id)));
CREATE POLICY "calendar exceptions change" ON public.calendar_event_exceptions FOR UPDATE TO authenticated USING (private.can_edit_calendar(private.event_calendar(event_id))) WITH CHECK (private.can_edit_calendar(private.event_calendar(event_id)));
CREATE POLICY "calendar exceptions delete" ON public.calendar_event_exceptions FOR DELETE TO authenticated USING (private.can_edit_calendar(private.event_calendar(event_id)));

CREATE OR REPLACE FUNCTION private.calendar_fill_hotel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _h uuid;
BEGIN
  SELECT hotel_id INTO _h FROM public.calendars WHERE id = NEW.calendar_id;
  IF _h IS NULL THEN RAISE EXCEPTION 'Calendar not found'; END IF;
  NEW.hotel_id := _h;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.calendar_exception_fill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _h uuid; _name text;
BEGIN
  SELECT hotel_id INTO _h FROM public.calendar_events WHERE id = NEW.event_id;
  IF _h IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  NEW.hotel_id := _h;
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    SELECT coalesce(nullif(p.display_name,''), nullif(split_part(p.email,'@',1),''), 'Staff') INTO _name FROM public.profiles p WHERE p.id = auth.uid();
    NEW.updated_by_name := coalesce(_name, 'Staff');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.calendar_event_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF NEW.timezone IS NULL THEN
    SELECT h.timezone INTO NEW.timezone FROM public.hotels h WHERE h.id = NEW.hotel_id;
  END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(p.display_name,''), nullif(split_part(p.email,'@',1),''), 'Staff') INTO _name FROM public.profiles p WHERE p.id = auth.uid();
  _name := coalesce(_name, 'Staff');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.created_by_name := _name; NEW.created_at := now(); NEW.updated_at := now();
    NEW.version := 1; NEW.updated_by := NULL; NEW.updated_by_name := NULL;
  ELSE
    NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name; NEW.created_at := OLD.created_at;
    NEW.version := OLD.version + 1; NEW.updated_at := now(); NEW.updated_by := auth.uid(); NEW.updated_by_name := _name;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.calendar_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.calendar_fill_hotel(), private.calendar_exception_fill(), private.calendar_event_identity(), private.calendar_touch() FROM PUBLIC, anon;

CREATE TRIGGER a_calendar_hotel BEFORE INSERT OR UPDATE ON public.calendar_shares FOR EACH ROW EXECUTE FUNCTION private.calendar_fill_hotel();
CREATE TRIGGER a_calendar_hotel BEFORE INSERT OR UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION private.calendar_fill_hotel();
CREATE TRIGGER a_event_hotel BEFORE INSERT OR UPDATE ON public.calendar_event_exceptions FOR EACH ROW EXECUTE FUNCTION private.calendar_exception_fill();
CREATE TRIGGER b_event_identity BEFORE INSERT OR UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION private.calendar_event_identity();
CREATE TRIGGER b_calendar_touch BEFORE UPDATE ON public.calendars FOR EACH ROW EXECUTE FUNCTION private.calendar_touch();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.calendars FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_shares FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_event_exceptions FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendars','calendar_shares','calendar_events','calendar_event_exceptions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;