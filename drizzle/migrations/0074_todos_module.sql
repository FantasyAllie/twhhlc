CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  department text CHECK (department IN ('housekeeping','reception','fnb','maintenance')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  due_at timestamptz,
  due_all_day boolean NOT NULL DEFAULT false,
  timezone text NOT NULL,
  rrule text CHECK (rrule IS NULL OR (char_length(rrule) <= 500 AND rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Za-z0-9,+:-]+)*$')),
  repeat_until timestamptz,
  room_number integer,
  area_id uuid REFERENCES public.maintenance_areas(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT 'Staff',
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_id IS NULL) <> (department IS NULL)),
  CHECK (rrule IS NULL OR due_at IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT ALL ON public.todos TO service_role;
REVOKE ALL ON public.todos FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.todos FROM authenticated;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE INDEX todos_owner ON public.todos(hotel_id, owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX todos_department ON public.todos(hotel_id, department) WHERE department IS NOT NULL;
CREATE INDEX todos_due ON public.todos(hotel_id, due_at);
CREATE INDEX todos_owner_id ON public.todos(owner_id);
CREATE INDEX todos_area_id ON public.todos(area_id);
CREATE INDEX todos_creator ON public.todos(created_by);

CREATE TABLE public.todo_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  todo_id uuid NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  occurrence_key text NOT NULL CHECK (occurrence_key = 'once' OR occurrence_key ~ '^\d{4}-\d{2}-\d{2}T'),
  status text NOT NULL CHECK (status IN ('claimed','done')),
  by_user uuid,
  by_name text NOT NULL DEFAULT 'Staff',
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (todo_id, occurrence_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_marks TO authenticated;
GRANT ALL ON public.todo_marks TO service_role;
REVOKE ALL ON public.todo_marks FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.todo_marks FROM authenticated;
ALTER TABLE public.todo_marks ENABLE ROW LEVEL SECURITY;
CREATE INDEX todo_marks_hotel ON public.todo_marks(hotel_id);

CREATE TABLE public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  department text NOT NULL CHECK (department IN ('housekeeping','reception','fnb','maintenance')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  weekdays integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}' CHECK (weekdays <@ ARRAY[0,1,2,3,4,5,6] AND cardinality(weekdays) >= 1),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;
REVOKE ALL ON public.routines FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.routines FROM authenticated;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE INDEX routines_hotel ON public.routines(hotel_id, department, sort_order);

CREATE TABLE public.routine_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 200),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_steps TO authenticated;
GRANT ALL ON public.routine_steps TO service_role;
REVOKE ALL ON public.routine_steps FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.routine_steps FROM authenticated;
ALTER TABLE public.routine_steps ENABLE ROW LEVEL SECURITY;
CREATE INDEX routine_steps_routine ON public.routine_steps(routine_id, sort_order);
CREATE INDEX routine_steps_hotel ON public.routine_steps(hotel_id);

CREATE TABLE public.routine_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.routine_steps(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  step_text text NOT NULL DEFAULT '',
  by_user uuid,
  by_name text NOT NULL DEFAULT 'Staff',
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, run_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_ticks TO authenticated;
GRANT ALL ON public.routine_ticks TO service_role;
REVOKE ALL ON public.routine_ticks FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.routine_ticks FROM authenticated;
ALTER TABLE public.routine_ticks ENABLE ROW LEVEL SECURITY;
CREATE INDEX routine_ticks_run ON public.routine_ticks(routine_id, run_date);
CREATE INDEX routine_ticks_hotel ON public.routine_ticks(hotel_id);

CREATE OR REPLACE FUNCTION private.can_see_todo(_hotel_id uuid, _owner_id uuid, _department text, _created_by uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_module(_hotel_id, 'todos') AND (
    _owner_id = auth.uid() OR _created_by = auth.uid()
    OR (_department IS NOT NULL AND (
      _department = ANY (private.user_departments(auth.uid()))
      OR private.is_admin_or_manager(auth.uid())))
  );
$$;
CREATE OR REPLACE FUNCTION private.can_edit_todo(_hotel_id uuid, _owner_id uuid, _department text, _created_by uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.can_see_todo(_hotel_id, _owner_id, _department, _created_by) AND (
    _created_by = auth.uid() OR _owner_id = auth.uid() OR private.is_admin_or_manager(auth.uid())
  );
$$;
CREATE OR REPLACE FUNCTION private.can_work_todo(_todo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.todos t WHERE t.id = _todo_id
    AND private.can_see_todo(t.hotel_id, t.owner_id, t.department, t.created_by));
$$;
CREATE OR REPLACE FUNCTION private.can_use_routine(_hotel_id uuid, _department text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_module(_hotel_id, 'todos') AND (
    _department = ANY (private.user_departments(auth.uid())) OR private.is_admin_or_manager(auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.can_see_todo(uuid,uuid,text,uuid), private.can_edit_todo(uuid,uuid,text,uuid), private.can_work_todo(uuid), private.can_use_routine(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_see_todo(uuid,uuid,text,uuid), private.can_edit_todo(uuid,uuid,text,uuid), private.can_work_todo(uuid), private.can_use_routine(uuid,text) TO authenticated, service_role;

CREATE POLICY todos_read ON public.todos FOR SELECT TO authenticated USING (private.can_see_todo(hotel_id, owner_id, department, created_by));
CREATE POLICY todos_add ON public.todos FOR INSERT TO authenticated WITH CHECK (
  private.has_module(hotel_id, 'todos') AND private.can_access_hotel(hotel_id) AND (
    (owner_id = auth.uid() AND department IS NULL) OR (
      private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, 'todos') AND (
        private.has_role(auth.uid(), 'admin'::public.app_role)
        OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
        OR private.has_role(auth.uid(), 'manager'::public.app_role)
        OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(), 'developer'::public.app_role))
      ) AND (owner_id IS NULL OR EXISTS (SELECT 1 FROM public.hotel_members hm WHERE hm.user_id = todos.owner_id AND hm.hotel_id = todos.hotel_id))
    )
  )
);
CREATE POLICY todos_edit ON public.todos FOR UPDATE TO authenticated USING (private.can_edit_todo(hotel_id, owner_id, department, created_by)) WITH CHECK (private.can_edit_todo(hotel_id, owner_id, department, created_by));
CREATE POLICY todos_delete ON public.todos FOR DELETE TO authenticated USING (private.can_edit_todo(hotel_id, owner_id, department, created_by));
CREATE POLICY todo_marks_read ON public.todo_marks FOR SELECT TO authenticated USING (private.can_work_todo(todo_id));
CREATE POLICY todo_marks_add ON public.todo_marks FOR INSERT TO authenticated WITH CHECK (private.can_work_todo(todo_id));
CREATE POLICY todo_marks_edit ON public.todo_marks FOR UPDATE TO authenticated USING (private.can_work_todo(todo_id)) WITH CHECK (private.can_work_todo(todo_id));
CREATE POLICY todo_marks_delete ON public.todo_marks FOR DELETE TO authenticated USING (private.can_work_todo(todo_id));
CREATE POLICY routines_read ON public.routines FOR SELECT TO authenticated USING (private.can_use_routine(hotel_id, department));
CREATE POLICY routine_steps_read ON public.routine_steps FOR SELECT TO authenticated USING (private.can_use_routine(hotel_id, (SELECT r.department FROM public.routines r WHERE r.id = routine_id)));

DO $$
DECLARE t text; manage text := 'private.can_access_hotel(hotel_id) AND private.has_module(hotel_id, ''todos'') AND (private.has_role(auth.uid(), ''admin''::public.app_role) OR private.has_role(auth.uid(), ''regional_admin''::public.app_role) OR private.has_role(auth.uid(), ''manager''::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(), ''developer''::public.app_role)))';
BEGIN
  FOREACH t IN ARRAY ARRAY['routines','routine_steps'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t || '_add', t, manage);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t || '_edit', t, manage, manage);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', t || '_delete', t, manage);
  END LOOP;
END $$;
CREATE POLICY routine_ticks_read ON public.routine_ticks FOR SELECT TO authenticated USING (private.can_use_routine(hotel_id, (SELECT r.department FROM public.routines r WHERE r.id = routine_id)));
CREATE POLICY routine_ticks_add ON public.routine_ticks FOR INSERT TO authenticated WITH CHECK (private.can_use_routine(hotel_id, (SELECT r.department FROM public.routines r WHERE r.id = routine_id)));
CREATE POLICY routine_ticks_delete ON public.routine_ticks FOR DELETE TO authenticated USING (private.can_use_routine(hotel_id, (SELECT r.department FROM public.routines r WHERE r.id = routine_id)));

CREATE OR REPLACE FUNCTION private.todo_hotel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT t.hotel_id INTO NEW.hotel_id FROM public.todos t WHERE t.id = NEW.todo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job does not exist'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.routine_hotel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT r.hotel_id INTO NEW.hotel_id FROM public.routines r WHERE r.id = NEW.routine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Routine does not exist'; END IF;
  IF TG_TABLE_NAME = 'routine_ticks' THEN
    SELECT s.text INTO NEW.step_text FROM public.routine_steps s WHERE s.id = NEW.step_id AND s.routine_id = NEW.routine_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Step does not belong to this routine'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.todo_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE staff_name text;
BEGIN
  IF NEW.timezone IS NULL THEN
    SELECT h.timezone INTO NEW.timezone FROM public.hotels h WHERE h.id = NEW.hotel_id;
  END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(display_name,''), nullif(split_part(email,'@',1),''), 'Staff') INTO staff_name FROM public.profiles WHERE id = auth.uid();
  staff_name := coalesce(staff_name, 'Staff');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.created_by_name := staff_name; NEW.created_at := now(); NEW.updated_at := now(); NEW.version := 1; NEW.updated_by_name := NULL;
  ELSE
    NEW.hotel_id := OLD.hotel_id; NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name; NEW.created_at := OLD.created_at;
    IF NOT private.is_admin_or_manager(auth.uid()) THEN
      NEW.owner_id := OLD.owner_id; NEW.department := OLD.department;
    END IF;
    NEW.version := OLD.version + 1; NEW.updated_at := now(); NEW.updated_by_name := staff_name;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.todo_mark_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.by_user := auth.uid();
    SELECT coalesce(nullif(display_name,''), nullif(split_part(email,'@',1),''), 'Staff') INTO NEW.by_name FROM public.profiles WHERE id = auth.uid();
    NEW.by_name := coalesce(NEW.by_name, 'Staff'); NEW.at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.routine_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.todo_hotel(), private.routine_hotel(), private.todo_identity(), private.todo_mark_identity(), private.routine_touch() FROM PUBLIC, anon;

CREATE TRIGGER a_todo_hotel BEFORE INSERT OR UPDATE ON public.todo_marks FOR EACH ROW EXECUTE FUNCTION private.todo_hotel();
CREATE TRIGGER a_routine_hotel BEFORE INSERT OR UPDATE ON public.routine_steps FOR EACH ROW EXECUTE FUNCTION private.routine_hotel();
CREATE TRIGGER a_routine_hotel BEFORE INSERT OR UPDATE ON public.routine_ticks FOR EACH ROW EXECUTE FUNCTION private.routine_hotel();
CREATE TRIGGER b_todo_identity BEFORE INSERT OR UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION private.todo_identity();
CREATE TRIGGER b_mark_identity BEFORE INSERT OR UPDATE ON public.todo_marks FOR EACH ROW EXECUTE FUNCTION private.todo_mark_identity();
CREATE TRIGGER b_tick_identity BEFORE INSERT OR UPDATE ON public.routine_ticks FOR EACH ROW EXECUTE FUNCTION private.todo_mark_identity();
CREATE TRIGGER b_routine_touch BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION private.routine_touch();
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['todos','todo_marks','routines','routine_steps','routine_ticks'] LOOP
    EXECUTE format('CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels()', t);
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;