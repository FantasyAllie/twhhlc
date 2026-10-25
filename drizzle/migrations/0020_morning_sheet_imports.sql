CREATE TABLE public.morning_sheet_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  uploaded_by_name text,
  file_name text NOT NULL,
  sheet_date date,
  status text NOT NULL DEFAULT 'pending',
  room_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX morning_sheet_imports_hotel_status_idx ON public.morning_sheet_imports (hotel_id, status, created_at DESC);

GRANT SELECT, INSERT ON public.morning_sheet_imports TO authenticated;
GRANT ALL ON public.morning_sheet_imports TO service_role;
ALTER TABLE public.morning_sheet_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel staff read morning sheets" ON public.morning_sheet_imports FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "Hotel staff upload morning sheets" ON public.morning_sheet_imports FOR INSERT TO authenticated
  WITH CHECK (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id) AND uploaded_by = auth.uid() AND status = 'pending');

-- A new upload replaces any earlier pending sheet for the same hotel.
CREATE OR REPLACE FUNCTION public.supersede_pending_morning_sheets() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.morning_sheet_imports SET status='discarded', resolved_at=now(), resolved_by=NEW.uploaded_by, resolved_by_name=NEW.uploaded_by_name
   WHERE hotel_id=NEW.hotel_id AND status='pending' AND id<>NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER morning_sheet_supersede AFTER INSERT ON public.morning_sheet_imports FOR EACH ROW EXECUTE FUNCTION public.supersede_pending_morning_sheets();

-- Apply or discard a pending sheet atomically. Applying updates every listed room.
CREATE OR REPLACE FUNCTION public.resolve_morning_sheet(p_import uuid, p_apply boolean, p_name text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_imp public.morning_sheet_imports; v_row jsonb; v_status uuid; v_arrival uuid; v_bed uuid; v_count integer := 0; v_label text;
BEGIN
  SELECT * INTO v_imp FROM public.morning_sheet_imports WHERE id=p_import FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Morning sheet not found'; END IF;
  IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_imp.hotel_id) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF v_imp.status<>'pending' THEN RAISE EXCEPTION 'This morning sheet has already been handled'; END IF;
  IF p_apply THEN
    SELECT id INTO v_arrival FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='status' AND lower(label)='arrival' LIMIT 1;
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_imp.payload) LOOP
      v_label := v_row->>'status_label';
      SELECT id INTO v_status FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='status' AND lower(label)=lower(v_label) LIMIT 1;
      v_bed := NULL;
      IF v_row->>'bed' IS NOT NULL THEN
        SELECT id INTO v_bed FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='bed' AND lower(label)=lower(v_row->>'bed') LIMIT 1;
      END IF;
      UPDATE public.rooms SET
        reception_status_id = coalesce(v_status, reception_status_id),
        reception_status_secondary_id = CASE WHEN v_row->>'kind'='turnover' THEN v_arrival ELSE NULL END,
        reception_bed_id = coalesce(v_bed, reception_bed_id),
        dog_box = coalesce((v_row->>'dog')::boolean, false),
        dog_box_at = CASE WHEN coalesce((v_row->>'dog')::boolean,false) AND NOT dog_box THEN now() WHEN coalesce((v_row->>'dog')::boolean,false) THEN dog_box_at ELSE NULL END,
        housekeeping_note = CASE WHEN v_row->>'notes' IS NOT NULL THEN v_row->>'notes' ELSE housekeeping_note END,
        done = CASE WHEN v_row->>'kind' IN ('vacant','ros') THEN done ELSE false END,
        guest_vacated = false, guest_vacated_at = NULL,
        updated_at = now()
      WHERE hotel_id=v_imp.hotel_id AND room_number=(v_row->>'room_number')::integer;
      IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;
  END IF;
  UPDATE public.morning_sheet_imports SET status=CASE WHEN p_apply THEN 'applied' ELSE 'discarded' END,
    resolved_by=auth.uid(), resolved_by_name=p_name, resolved_at=now() WHERE id=p_import;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.resolve_morning_sheet(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_morning_sheet(uuid,boolean,text) TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.morning_sheet_imports;
