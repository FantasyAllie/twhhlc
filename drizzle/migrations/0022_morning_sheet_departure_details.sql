ALTER TABLE public.rooms ADD COLUMN sheet_kind text, ADD COLUMN sheet_guests integer, ADD COLUMN sheet_bed text, ADD COLUMN sheet_room_type text;

CREATE OR REPLACE FUNCTION private.can_upload_morning_sheet() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT private.is_approved(auth.uid()) AND (
   private.has_role(auth.uid(), 'reception') OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer') OR private.has_role(auth.uid(), 'regional_admin')
   OR (private.has_role(auth.uid(), 'manager') AND private.has_role(auth.uid(), 'housekeeper')));
$$;
GRANT EXECUTE ON FUNCTION private.can_upload_morning_sheet() TO authenticated;

ALTER POLICY "Hotel staff upload morning sheets" ON public.morning_sheet_imports
  WITH CHECK (private.can_upload_morning_sheet() AND private.can_access_hotel(hotel_id) AND uploaded_by = auth.uid() AND status = 'pending');

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
        sheet_kind = v_row->>'kind',
        sheet_guests = coalesce((v_row->>'adults')::int,0) + coalesce((v_row->>'children')::int,0) + coalesce((v_row->>'infants')::int,0),
        sheet_bed = v_row->>'bed',
        sheet_room_type = v_row->>'room_type',
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