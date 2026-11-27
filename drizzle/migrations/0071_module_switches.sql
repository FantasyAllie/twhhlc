CREATE TABLE public.hotel_modules (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('calendar','todos','notes')),
  enabled boolean NOT NULL DEFAULT false,
  all_departments boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (hotel_id, module)
);

CREATE TABLE public.module_departments (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('calendar','todos','notes')),
  department text NOT NULL CHECK (department IN ('housekeeping','reception','fnb','maintenance')),
  PRIMARY KEY (hotel_id, module, department)
);

CREATE TABLE public.module_people (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('calendar','todos','notes')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  PRIMARY KEY (hotel_id, module, user_id)
);
CREATE INDEX module_people_user ON public.module_people(user_id);

REVOKE ALL ON public.hotel_modules, public.module_departments, public.module_people FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.hotel_modules, public.module_departments, public.module_people FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_modules, public.module_departments, public.module_people TO authenticated;
GRANT ALL ON public.hotel_modules, public.module_departments, public.module_people TO service_role;

ALTER TABLE public.hotel_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_people ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.has_module(_hotel_id uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_approved(auth.uid())
    AND private.can_access_hotel(_hotel_id)
    AND EXISTS (SELECT 1 FROM public.hotel_modules m
                WHERE m.hotel_id = _hotel_id AND m.module = _module AND m.enabled)
    AND (
      private.is_admin_or_manager(auth.uid())
      OR COALESCE(
        (SELECT p.allowed FROM public.module_people p
          WHERE p.hotel_id = _hotel_id AND p.module = _module AND p.user_id = auth.uid()),
        (SELECT m.all_departments FROM public.hotel_modules m
          WHERE m.hotel_id = _hotel_id AND m.module = _module)
        OR EXISTS (SELECT 1 FROM public.module_departments d
          WHERE d.hotel_id = _hotel_id AND d.module = _module
            AND d.department = ANY (private.user_departments(auth.uid())))
      )
    );
$$;
REVOKE ALL ON FUNCTION private.has_module(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_module(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_modules()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(m ORDER BY m), '{}')
  FROM unnest(ARRAY['calendar','notes','todos']) AS m
  WHERE private.has_module(private.current_hotel_id(), m);
$$;
REVOKE ALL ON FUNCTION public.my_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_modules() TO authenticated, service_role;

-- hotel_modules
CREATE POLICY "hotel modules read" ON public.hotel_modules FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "hotel modules insert" ON public.hotel_modules FOR INSERT TO authenticated
  WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY "hotel modules update" ON public.hotel_modules FOR UPDATE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))))
  WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY "hotel modules delete" ON public.hotel_modules FOR DELETE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));

-- module_departments
CREATE POLICY "module departments read" ON public.module_departments FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "module departments insert" ON public.module_departments FOR INSERT TO authenticated
  WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY "module departments update" ON public.module_departments FOR UPDATE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))))
  WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY "module departments delete" ON public.module_departments FOR DELETE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));

-- module_people
CREATE POLICY "module people read" ON public.module_people FOR SELECT TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY "module people insert" ON public.module_people FOR INSERT TO authenticated
  WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role)))
    AND EXISTS (SELECT 1 FROM public.hotel_members hm WHERE hm.user_id = module_people.user_id AND hm.hotel_id = module_people.hotel_id));
CREATE POLICY "module people update" ON public.module_people FOR UPDATE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))))
  WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role)))
    AND EXISTS (SELECT 1 FROM public.hotel_members hm WHERE hm.user_id = module_people.user_id AND hm.hotel_id = module_people.hotel_id));
CREATE POLICY "module people delete" ON public.module_people FOR DELETE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role) OR private.has_role(auth.uid(),'manager'::public.app_role) OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = hotel_id) AND private.has_role(auth.uid(),'developer'::public.app_role))));

-- triggers
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.hotel_modules FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.module_departments FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.module_people FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();

CREATE OR REPLACE FUNCTION private.touch_hotel_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.touch_hotel_modules() FROM PUBLIC, anon;
CREATE TRIGGER set_hotel_modules_editor BEFORE INSERT OR UPDATE ON public.hotel_modules FOR EACH ROW EXECUTE FUNCTION private.touch_hotel_modules();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hotel_modules','module_departments','module_people'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;