ALTER TABLE public.hotel_modules DROP CONSTRAINT hotel_modules_module_check;
ALTER TABLE public.hotel_modules ADD CONSTRAINT hotel_modules_module_check CHECK (module IN ('calendar','todos','notes','compliance'));
ALTER TABLE public.module_departments DROP CONSTRAINT module_departments_module_check;
ALTER TABLE public.module_departments ADD CONSTRAINT module_departments_module_check CHECK (module IN ('calendar','todos','notes','compliance'));
ALTER TABLE public.module_people DROP CONSTRAINT module_people_module_check;
ALTER TABLE public.module_people ADD CONSTRAINT module_people_module_check CHECK (module IN ('calendar','todos','notes','compliance'));

CREATE TABLE public.compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('fire','water','food','other')),
  department text NOT NULL CHECK (department IN ('housekeeping','reception','fnb','maintenance')),
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  every integer NOT NULL DEFAULT 1 CHECK (every BETWEEN 1 AND 52),
  room_number integer,
  area_id uuid REFERENCES public.maintenance_areas(id) ON DELETE SET NULL,
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 2000),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_checks TO authenticated;
GRANT ALL ON public.compliance_checks TO service_role;
REVOKE ALL ON public.compliance_checks FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.compliance_checks FROM authenticated;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX compliance_checks_hotel ON public.compliance_checks(hotel_id, category, sort_order);
CREATE INDEX compliance_checks_area ON public.compliance_checks(area_id);

CREATE TABLE public.compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  check_id uuid NOT NULL REFERENCES public.compliance_checks(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('tick','yesno','reading','note')),
  unit text NOT NULL DEFAULT '' CHECK (char_length(unit) <= 12),
  min_value numeric,
  max_value numeric,
  pass_answer boolean NOT NULL DEFAULT true,
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_items TO authenticated;
GRANT ALL ON public.compliance_items TO service_role;
REVOKE ALL ON public.compliance_items FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.compliance_items FROM authenticated;
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX compliance_items_check ON public.compliance_items(check_id, sort_order);
CREATE INDEX compliance_items_hotel ON public.compliance_items(hotel_id);

CREATE TABLE public.compliance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  check_id uuid NOT NULL REFERENCES public.compliance_checks(id) ON DELETE RESTRICT,
  check_name text NOT NULL,
  passed boolean NOT NULL,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  photo_paths text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photo_paths) <= 6),
  corrects_id uuid REFERENCES public.compliance_records(id) ON DELETE RESTRICT,
  correction_reason text CHECK (correction_reason IS NULL OR char_length(btrim(correction_reason)) BETWEEN 1 AND 500),
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  by_user uuid NOT NULL,
  by_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((corrects_id IS NULL) = (correction_reason IS NULL))
);
REVOKE ALL ON public.compliance_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.compliance_records TO authenticated;
GRANT ALL ON public.compliance_records TO service_role;
ALTER TABLE public.compliance_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX compliance_records_check ON public.compliance_records(check_id, signed_at DESC);
CREATE INDEX compliance_records_hotel ON public.compliance_records(hotel_id, signed_at DESC);
CREATE INDEX compliance_records_corrects ON public.compliance_records(corrects_id);
CREATE INDEX compliance_records_maintenance ON public.compliance_records(maintenance_request_id);
CREATE INDEX compliance_records_signer ON public.compliance_records(by_user);

CREATE TABLE public.compliance_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.compliance_records(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.compliance_items(id) ON DELETE SET NULL,
  label text NOT NULL,
  kind text NOT NULL,
  unit text NOT NULL DEFAULT '',
  min_value numeric,
  max_value numeric,
  value_bool boolean,
  value_number numeric,
  value_text text CHECK (value_text IS NULL OR char_length(value_text) <= 1000),
  in_range boolean NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
REVOKE ALL ON public.compliance_values FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.compliance_values TO authenticated;
GRANT ALL ON public.compliance_values TO service_role;
ALTER TABLE public.compliance_values ENABLE ROW LEVEL SECURITY;
CREATE INDEX compliance_values_record ON public.compliance_values(record_id, sort_order);
CREATE INDEX compliance_values_hotel ON public.compliance_values(hotel_id);
CREATE INDEX compliance_values_item ON public.compliance_values(item_id);

CREATE OR REPLACE FUNCTION private.can_use_compliance(_hotel_id uuid, _department text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_module(_hotel_id, 'compliance') AND private.can_access_hotel(_hotel_id) AND (
    _department = ANY (private.user_departments(auth.uid())) OR private.is_admin_or_manager(auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.can_use_compliance(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_use_compliance(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_compliance_record(p_check uuid, p_values jsonb, p_notes text DEFAULT '', p_photos text[] DEFAULT '{}', p_corrects uuid DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.compliance_checks%ROWTYPE;
  i public.compliance_items%ROWTYPE;
  entry jsonb;
  snapshots jsonb := '[]'::jsonb;
  vb boolean;
  vn numeric;
  vt text;
  ok boolean;
  all_ok boolean := true;
  signer uuid := auth.uid();
  signer_name text;
  record_id uuid := gen_random_uuid();
  job_id uuid;
  area_name text;
  failures text[] := '{}';
  detail text;
BEGIN
  IF signer IS NULL THEN RAISE EXCEPTION 'Please sign in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.compliance_checks WHERE id = p_check FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check not found'; END IF;
  IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This check is archived'; END IF;
  IF NOT coalesce(private.can_use_compliance(c.hotel_id, c.department), false) THEN
    RAISE EXCEPTION 'You cannot sign this check' USING ERRCODE = '42501';
  END IF;
  IF p_corrects IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.compliance_records r WHERE r.id = p_corrects AND r.check_id = c.id AND r.hotel_id = c.hotel_id) THEN
      RAISE EXCEPTION 'Corrections must refer to a record of the same check';
    END IF;
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'Please give a correction reason'; END IF;
  ELSIF p_reason IS NOT NULL THEN
    RAISE EXCEPTION 'A correction reason requires an original record';
  END IF;
  IF char_length(btrim(coalesce(p_notes,''))) > 2000 OR char_length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'Notes or correction reason are too long';
  END IF;
  IF p_photos IS NULL OR cardinality(p_photos) > 6 OR EXISTS (
    SELECT 1 FROM unnest(p_photos) AS path WHERE path IS NULL OR left(path,37) <> c.hotel_id::text || '/'
  ) THEN RAISE EXCEPTION 'Use at most six photos from this hotel'; END IF;
  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'array' THEN RAISE EXCEPTION 'Values must be an array'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_values) e WHERE jsonb_typeof(e) <> 'object' OR jsonb_typeof(e->'item_id') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Every value must identify an item';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_values) e GROUP BY e->>'item_id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Only one value per item is allowed';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_values) e WHERE NOT EXISTS (
    SELECT 1 FROM public.compliance_items ci WHERE ci.id::text = e->>'item_id' AND ci.check_id = c.id AND ci.archived_at IS NULL
  )) THEN RAISE EXCEPTION 'Values must belong to active items of this check'; END IF;

  SELECT coalesce(nullif(display_name,''), nullif(split_part(email,'@',1),''), 'Staff') INTO signer_name
    FROM public.profiles WHERE id = signer;
  signer_name := coalesce(signer_name, 'Staff');
  FOR i IN SELECT * FROM public.compliance_items WHERE check_id = c.id AND archived_at IS NULL ORDER BY sort_order,id FOR SHARE LOOP
    SELECT e INTO entry FROM jsonb_array_elements(p_values) e WHERE e->>'item_id' = i.id::text;
    IF (entry->'bool' IS NOT NULL AND jsonb_typeof(entry->'bool') NOT IN ('boolean','null'))
      OR (entry->'number' IS NOT NULL AND jsonb_typeof(entry->'number') NOT IN ('number','null'))
      OR (entry->'text' IS NOT NULL AND jsonb_typeof(entry->'text') NOT IN ('string','null')) THEN
      RAISE EXCEPTION 'Answers must use the item value type';
    END IF;
    vb := NULL; vn := NULL; vt := NULL;
    CASE i.kind
      WHEN 'tick' THEN
        vb := (entry->>'bool')::boolean;
        IF vb IS NULL AND i.required THEN RAISE EXCEPTION 'Please complete every item'; END IF;
        ok := coalesce(vb, false);
        detail := i.label || ': ' || CASE WHEN vb IS NULL THEN 'Not recorded' WHEN vb THEN 'Yes' ELSE 'No' END;
      WHEN 'yesno' THEN
        vb := (entry->>'bool')::boolean;
        IF vb IS NULL AND i.required THEN RAISE EXCEPTION 'Please complete every item'; END IF;
        ok := coalesce(vb = i.pass_answer, false);
        detail := i.label || ': ' || CASE WHEN vb IS NULL THEN 'Not recorded' WHEN vb THEN 'Yes' ELSE 'No' END;
      WHEN 'reading' THEN
        vn := (entry->>'number')::numeric;
        IF vn IS NULL AND i.required THEN RAISE EXCEPTION 'Please complete every item'; END IF;
        ok := vn IS NOT NULL AND (i.min_value IS NULL OR vn >= i.min_value) AND (i.max_value IS NULL OR vn <= i.max_value);
        detail := i.label || ' ' || coalesce(vn::text,'Not recorded') || CASE WHEN i.unit = '' THEN '' ELSE ' ' || i.unit END;
        IF i.min_value IS NOT NULL OR i.max_value IS NOT NULL THEN
          detail := detail || ' (should be ' || CASE
            WHEN i.min_value IS NULL THEN 'at most ' || i.max_value::text
            WHEN i.max_value IS NULL THEN 'at least ' || i.min_value::text
            ELSE i.min_value::text || '–' || i.max_value::text END || CASE WHEN i.unit = '' THEN '' ELSE ' ' || i.unit END || ')';
        END IF;
      WHEN 'note' THEN
        vt := entry->>'text';
        IF char_length(vt) > 1000 THEN RAISE EXCEPTION 'Item notes must be at most 1000 characters'; END IF;
        ok := true;
    END CASE;
    all_ok := all_ok AND ok;
    IF NOT ok THEN failures := array_append(failures, detail); END IF;
    snapshots := snapshots || jsonb_build_array(jsonb_build_object(
      'item_id',i.id,'label',i.label,'kind',i.kind,'unit',i.unit,'min_value',i.min_value,'max_value',i.max_value,
      'value_bool',vb,'value_number',vn,'value_text',vt,'in_range',ok,'sort_order',i.sort_order));
  END LOOP;

  -- Create the job first so the signed record is inserted complete, never updated after signing.
  IF NOT all_ok THEN
    SELECT label INTO area_name FROM public.maintenance_areas WHERE id = c.area_id AND hotel_id = c.hotel_id;
    INSERT INTO public.maintenance_requests(hotel_id,user_id,created_by_username,room_number,area_label,urgent,origin_department,message)
      VALUES (c.hotel_id,signer,signer_name,c.room_number,area_name,true,c.department,
        left('Compliance: ' || c.name || ' — ' || array_to_string(failures,'; '),500)) RETURNING id INTO job_id;
  END IF;
  INSERT INTO public.compliance_records(id,hotel_id,check_id,check_name,passed,notes,photo_paths,corrects_id,correction_reason,maintenance_request_id,by_user,by_name,signed_at)
    VALUES (record_id,c.hotel_id,c.id,c.name,all_ok,btrim(coalesce(p_notes,'')),p_photos,p_corrects,btrim(p_reason),job_id,signer,signer_name,now());
  INSERT INTO public.compliance_values(hotel_id,record_id,item_id,label,kind,unit,min_value,max_value,value_bool,value_number,value_text,in_range,sort_order)
    SELECT c.hotel_id,record_id,s.item_id,s.label,s.kind,s.unit,s.min_value,s.max_value,s.value_bool,s.value_number,s.value_text,s.in_range,s.sort_order
    FROM jsonb_to_recordset(snapshots) AS s(item_id uuid,label text,kind text,unit text,min_value numeric,max_value numeric,value_bool boolean,value_number numeric,value_text text,in_range boolean,sort_order integer);
  RETURN record_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_compliance_record(uuid,jsonb,text,text[],uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_compliance_record(uuid,jsonb,text,text[],uuid,text) TO authenticated, service_role;

CREATE POLICY compliance_checks_read ON public.compliance_checks FOR SELECT TO authenticated
  USING (private.can_use_compliance(hotel_id,department));
CREATE POLICY compliance_checks_insert ON public.compliance_checks FOR INSERT TO authenticated
  WITH CHECK (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY compliance_checks_update ON public.compliance_checks FOR UPDATE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role))))
  WITH CHECK (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY compliance_checks_delete ON public.compliance_checks FOR DELETE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role)))
    AND NOT EXISTS (SELECT 1 FROM public.compliance_records r WHERE r.check_id = compliance_checks.id));
CREATE POLICY compliance_items_read ON public.compliance_items FOR SELECT TO authenticated
  USING (private.can_use_compliance(hotel_id,(SELECT c.department FROM public.compliance_checks c WHERE c.id = check_id)));
CREATE POLICY compliance_items_insert ON public.compliance_items FOR INSERT TO authenticated
  WITH CHECK (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY compliance_items_update ON public.compliance_items FOR UPDATE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role))))
  WITH CHECK (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role))));
CREATE POLICY compliance_items_delete ON public.compliance_items FOR DELETE TO authenticated
  USING (private.can_access_hotel(hotel_id) AND private.has_module(hotel_id,'compliance') AND (
    private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(),'manager'::public.app_role) OR (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.developer_only) AND private.has_role(auth.uid(),'developer'::public.app_role)))
    AND NOT EXISTS (SELECT 1 FROM public.compliance_values v WHERE v.item_id = compliance_items.id));
CREATE POLICY compliance_records_read ON public.compliance_records FOR SELECT TO authenticated
  USING (private.can_use_compliance(hotel_id,(SELECT c.department FROM public.compliance_checks c WHERE c.id = check_id)));
CREATE POLICY compliance_values_read ON public.compliance_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compliance_records r WHERE r.id = record_id));

CREATE OR REPLACE FUNCTION private.compliance_item_hotel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT hotel_id INTO NEW.hotel_id FROM public.compliance_checks WHERE id = NEW.check_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check not found'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.check_id IS DISTINCT FROM OLD.check_id AND EXISTS (
    SELECT 1 FROM public.compliance_values WHERE item_id = OLD.id
  ) THEN RAISE EXCEPTION 'An item with signed records cannot move to another check'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION private.compliance_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now(); NEW.hotel_id := OLD.hotel_id; NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION private.compliance_locked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Depth alone is not sufficient: unrelated cascades must never unlock a signed record.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 AND NOT EXISTS (SELECT 1 FROM public.hotels WHERE id = OLD.hotel_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Signed compliance records can''t be changed. Add a correction instead.';
END;
$$;
REVOKE ALL ON FUNCTION private.compliance_item_hotel(), private.compliance_touch(), private.compliance_locked() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.compliance_item_hotel(), private.compliance_touch(), private.compliance_locked() TO service_role;
CREATE TRIGGER a_compliance_item_hotel BEFORE INSERT OR UPDATE ON public.compliance_items FOR EACH ROW EXECUTE FUNCTION private.compliance_item_hotel();
CREATE TRIGGER b_compliance_touch BEFORE UPDATE ON public.compliance_checks FOR EACH ROW EXECUTE FUNCTION private.compliance_touch();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_checks FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_items FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_records FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_values FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();
CREATE TRIGGER z_compliance_locked BEFORE UPDATE OR DELETE ON public.compliance_records FOR EACH ROW EXECUTE FUNCTION private.compliance_locked();
CREATE TRIGGER z_compliance_locked BEFORE UPDATE OR DELETE ON public.compliance_values FOR EACH ROW EXECUTE FUNCTION private.compliance_locked();

CREATE POLICY compliance_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'compliance-photos' AND private.can_access_hotel(((storage.foldername(name))[1])::uuid)
    AND private.has_module(((storage.foldername(name))[1])::uuid,'compliance'));
CREATE POLICY compliance_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'compliance-photos' AND private.can_access_hotel(((storage.foldername(name))[1])::uuid)
    AND private.has_module(((storage.foldername(name))[1])::uuid,'compliance'));
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['compliance_checks','compliance_items','compliance_records'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
    END IF;
  END LOOP;
END $$;

-- Transactional regression checks: every fixture and session setting is rolled back.
DO $$
DECLARE
  uid uuid; hid uuid := gen_random_uuid(); cid uuid; tickid uuid; yesid uuid; readid uuid; noteid uuid;
  rid uuid; failed uuid; corrected uuid; vals jsonb; rejected boolean;
BEGIN
  BEGIN
    SELECT user_id INTO uid FROM public.user_roles WHERE role = 'developer' LIMIT 1;
    IF uid IS NULL THEN RAISE EXCEPTION 'Compliance regression tests require an existing developer account'; END IF;
    INSERT INTO public.hotels(id,name,slug,developer_only) VALUES(hid,'Compliance regression fixture','compliance-test-' || hid::text,true);
    PERFORM set_config('request.jwt.claim.sub',uid::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    INSERT INTO public.user_active_hotel(user_id,hotel_id) VALUES(uid,hid) ON CONFLICT(user_id) DO UPDATE SET hotel_id = EXCLUDED.hotel_id;
    INSERT INTO public.hotel_modules(hotel_id,module,enabled) VALUES(hid,'compliance',true);
    INSERT INTO public.compliance_checks(hotel_id,name,department,frequency,room_number) VALUES(hid,'Fridge safety','fnb','daily',1) RETURNING id INTO cid;
    INSERT INTO public.compliance_items(check_id,label,kind) VALUES(cid,'Power on','tick') RETURNING id INTO tickid;
    INSERT INTO public.compliance_items(check_id,label,kind,pass_answer) VALUES(cid,'Fault present','yesno',false) RETURNING id INTO yesid;
    INSERT INTO public.compliance_items(check_id,label,kind,unit,min_value,max_value) VALUES(cid,'Temperature','reading','°C',0,5) RETURNING id INTO readid;
    INSERT INTO public.compliance_items(check_id,label,kind) VALUES(cid,'Comments','note') RETURNING id INTO noteid;
    vals := jsonb_build_array(jsonb_build_object('item_id',tickid,'bool',true),jsonb_build_object('item_id',yesid,'bool',false),jsonb_build_object('item_id',readid,'number',5));
    rid := public.submit_compliance_record(cid,vals,'  Signed  ');
    IF NOT EXISTS(SELECT 1 FROM public.compliance_records WHERE id=rid AND passed AND notes='Signed' AND by_user=uid AND maintenance_request_id IS NULL)
      OR (SELECT count(*) FROM public.compliance_values WHERE record_id=rid) <> 4 THEN RAISE EXCEPTION 'Passing record, signer, note trimming or per-item snapshot regression'; END IF;
    vals := jsonb_set(vals,'{2,number}','9');
    failed := public.submit_compliance_record(cid,vals);
    IF NOT EXISTS(SELECT 1 FROM public.compliance_records r JOIN public.maintenance_requests m ON m.id=r.maintenance_request_id
      WHERE r.id=failed AND NOT r.passed AND m.urgent AND m.room_number=1 AND m.origin_department='fnb' AND m.message LIKE '%Temperature 9 °C (should be 0–5 °C)%') THEN
      RAISE EXCEPTION 'Out-of-range reading must create a linked urgent maintenance job'; END IF;
    corrected := public.submit_compliance_record(cid,jsonb_set(vals,'{2,number}','0'),'','{}',failed,'Corrected reading');
    IF NOT EXISTS(SELECT 1 FROM public.compliance_records WHERE id=corrected AND passed AND corrects_id=failed AND correction_reason='Corrected reading') THEN RAISE EXCEPTION 'Correction regression'; END IF;
    UPDATE public.compliance_items SET label='Changed wording',max_value=1 WHERE id=readid;
    IF NOT EXISTS(SELECT 1 FROM public.compliance_values WHERE record_id=rid AND item_id=readid AND label='Temperature' AND max_value=5) THEN RAISE EXCEPTION 'Historical wording and limits must not change'; END IF;
    rejected := false;
    BEGIN PERFORM public.submit_compliance_record(cid,'[]'); EXCEPTION WHEN raise_exception THEN rejected := SQLERRM='Please complete every item'; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Missing required items must be rejected'; END IF;
    rejected := false;
    BEGIN PERFORM public.submit_compliance_record(cid,vals,'','{}',failed,' '); EXCEPTION WHEN raise_exception THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Blank correction reason must be rejected'; END IF;
    rejected := false;
    BEGIN PERFORM public.submit_compliance_record(cid,vals,'',ARRAY[gen_random_uuid()::text || '/photo.jpg']); EXCEPTION WHEN raise_exception THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Cross-hotel photos must be rejected'; END IF;
    rejected := false;
    BEGIN UPDATE public.compliance_records SET notes='Changed' WHERE id=rid; EXCEPTION WHEN raise_exception THEN rejected := SQLERRM='Signed compliance records can''t be changed. Add a correction instead.'; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Signed records must reject updates'; END IF;
    rejected := false;
    BEGIN DELETE FROM public.compliance_values WHERE record_id=rid; EXCEPTION WHEN raise_exception THEN rejected := SQLERRM='Signed compliance records can''t be changed. Add a correction instead.'; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Signed values must reject deletion'; END IF;
    UPDATE public.compliance_checks SET archived_at=now() WHERE id=cid;
    rejected := false;
    BEGIN PERFORM public.submit_compliance_record(cid,vals); EXCEPTION WHEN raise_exception THEN rejected := SQLERRM='This check is archived'; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Archived checks must reject signing'; END IF;
    UPDATE public.compliance_checks SET archived_at=NULL WHERE id=cid;
    UPDATE public.hotel_modules SET enabled=false WHERE hotel_id=hid AND module='compliance';
    rejected := false;
    BEGIN PERFORM public.submit_compliance_record(cid,vals); EXCEPTION WHEN insufficient_privilege THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Module disabled must reject signing'; END IF;
    RAISE EXCEPTION USING ERRCODE='PZ001',MESSAGE='Compliance regression checks passed; rolling back fixtures';
  EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  END;
END $$;