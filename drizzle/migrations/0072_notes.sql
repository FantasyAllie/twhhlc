CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  department text CHECK (department IN ('housekeeping','reception','fnb','maintenance')),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  pinned boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT 'Staff',
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_name text,
  CONSTRAINT notes_owner_xor_department CHECK ((owner_id IS NULL) <> (department IS NULL))
);
CREATE INDEX notes_owner ON public.notes(hotel_id, owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX notes_department ON public.notes(hotel_id, department) WHERE department IS NOT NULL;
CREATE INDEX notes_deleted ON public.notes(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.notes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

CREATE OR REPLACE FUNCTION private.can_reach_note(_hotel_id uuid, _owner_id uuid, _department text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_module(_hotel_id, 'notes')
    AND (
      (_owner_id IS NOT NULL AND _owner_id = auth.uid())
      OR (_department IS NOT NULL AND (
            _department = ANY (private.user_departments(auth.uid()))
            OR private.is_admin_or_manager(auth.uid())))
    );
$$;
REVOKE ALL ON FUNCTION private.can_reach_note(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_reach_note(uuid, uuid, text) TO authenticated, service_role;

CREATE POLICY "notes select" ON public.notes FOR SELECT TO authenticated
  USING (private.can_reach_note(hotel_id, owner_id, department));
CREATE POLICY "notes insert" ON public.notes FOR INSERT TO authenticated
  WITH CHECK (private.can_reach_note(hotel_id, owner_id, department));
CREATE POLICY "notes update" ON public.notes FOR UPDATE TO authenticated
  USING (private.can_reach_note(hotel_id, owner_id, department))
  WITH CHECK (private.can_reach_note(hotel_id, owner_id, department));
CREATE POLICY "notes delete forever" ON public.notes FOR DELETE TO authenticated
  USING (deleted_at IS NOT NULL AND private.can_reach_note(hotel_id, owner_id, department));

CREATE OR REPLACE FUNCTION private.note_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text;
BEGIN
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(nullif(p.display_name,''), nullif(split_part(p.email,'@',1),''), 'Staff')
    INTO _name FROM public.profiles p WHERE p.id = _uid;
  _name := coalesce(_name, 'Staff');

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := _uid;
    NEW.created_by_name := _name;
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.version := 1;
    NEW.updated_by := NULL;
    NEW.updated_by_name := NULL;
    NEW.deleted_at := NULL;
    NEW.deleted_by_name := NULL;
  ELSE
    NEW.hotel_id := OLD.hotel_id;
    NEW.owner_id := OLD.owner_id;
    NEW.department := OLD.department;
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
    NEW.updated_by := _uid;
    NEW.updated_by_name := _name;
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_at := now();
      NEW.deleted_by_name := _name;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      NEW.deleted_by_name := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.note_identity() FROM PUBLIC, anon;

CREATE TRIGGER note_identity BEFORE INSERT OR UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION private.note_identity();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-deleted-notes';
  PERFORM cron.schedule('purge-deleted-notes', '30 3 * * *',
    $job$DELETE FROM public.notes WHERE deleted_at < now() - interval '30 days';$job$);
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
  END IF;
END $$;