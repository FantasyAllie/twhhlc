-- Applying the paperwork: flags only on the day they're needed, and today's
-- hand-set flags kept.
--   * Dog box, baby cot and early check-in: arrivals and depart/arrivals only.
--   * Late checkout: departures and depart/arrivals only.
--   * Early check-in and late checkout are also read from notes written out in
--     full ("early check in", "late check out"); cots from "cot" in the notes.
--   * Guest has checked out, early check-in, late checkout and stayover guest out
--     that were set today stay on. Older ones are cleared, so yesterday's flags
--     don't carry over. Everything else (dog box, cots) follows the paperwork.
-- Baby cot is a hotel's own flag: any custom flag with "cot" in its name.
CREATE OR REPLACE FUNCTION public.resolve_morning_sheet(p_import uuid, p_apply boolean, p_name text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_imp public.morning_sheet_imports; v_row jsonb; v_status uuid; v_arrival uuid; v_bed uuid; v_count integer := 0; v_label text;
  v_kind text; v_notes text; v_room integer; v_arr boolean; v_dep boolean;
  v_dog boolean; v_eci boolean; v_lco boolean; v_cot boolean;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_cot_keys text[];
BEGIN
  SELECT * INTO v_imp FROM public.morning_sheet_imports WHERE id=p_import FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Morning sheet not found'; END IF;
  IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_imp.hotel_id) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF v_imp.status<>'pending' THEN RAISE EXCEPTION 'This morning sheet has already been handled'; END IF;
  IF p_apply THEN
    SELECT id INTO v_arrival FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='status' AND lower(label)='arrival' LIMIT 1;
    SELECT coalesce(array_agg(key), '{}') INTO v_cot_keys FROM public.room_flag_settings
      WHERE hotel_id=v_imp.hotel_id AND is_custom AND NOT coalesce(removed,false) AND label ~* '\mcots?\M';
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_imp.payload) LOOP
      v_label := v_row->>'status_label';
      v_kind := v_row->>'kind';
      v_notes := coalesce(v_row->>'notes', '');
      v_room := (v_row->>'room_number')::integer;
      v_arr := v_kind IN ('arrival','turnover');
      v_dep := v_kind IN ('departure','turnover');
      v_dog := coalesce((v_row->>'dog')::boolean, false) AND v_arr;
      v_eci := (coalesce((v_row->>'eci')::boolean, false) OR v_notes ~* 'early\s*check[\s-]*in') AND v_arr;
      v_lco := (coalesce((v_row->>'lco')::boolean, false) OR v_notes ~* 'late\s*check[\s-]*out') AND v_dep;
      v_cot := (coalesce((v_row->>'cot')::boolean, false) OR v_notes ~* '\mcots?\M') AND v_arr;
      SELECT id INTO v_status FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='status' AND lower(label)=lower(v_label) LIMIT 1;
      v_bed := NULL;
      IF v_row->>'bed' IS NOT NULL THEN
        SELECT id INTO v_bed FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='bed' AND lower(label)=lower(v_row->>'bed') LIMIT 1;
      END IF;
      UPDATE public.rooms SET
        reception_status_id = coalesce(v_status, reception_status_id),
        reception_status_secondary_id = CASE WHEN v_kind='turnover' THEN v_arrival ELSE NULL END,
        reception_bed_id = coalesce(v_bed, reception_bed_id),
        dog_box = v_dog,
        dog_box_at = CASE WHEN v_dog AND NOT dog_box THEN now() WHEN v_dog THEN dog_box_at ELSE NULL END,
        early_check_in = v_eci OR coalesce(early_check_in AND (early_check_in_at AT TIME ZONE 'Europe/London')::date = v_today, false),
        early_check_in_at = CASE
          WHEN early_check_in AND (early_check_in_at AT TIME ZONE 'Europe/London')::date = v_today THEN early_check_in_at
          WHEN v_eci THEN now() ELSE NULL END,
        late_checkout = v_lco OR coalesce(late_checkout AND (late_checkout_at AT TIME ZONE 'Europe/London')::date = v_today, false),
        late_checkout_at = CASE
          WHEN late_checkout AND (late_checkout_at AT TIME ZONE 'Europe/London')::date = v_today THEN late_checkout_at
          WHEN v_lco THEN now() ELSE NULL END,
        stayover_out = coalesce(stayover_out AND (stayover_out_at AT TIME ZONE 'Europe/London')::date = v_today, false),
        stayover_out_at = CASE WHEN stayover_out AND (stayover_out_at AT TIME ZONE 'Europe/London')::date = v_today THEN stayover_out_at ELSE NULL END,
        housekeeping_note = CASE WHEN v_row->>'notes' IS NOT NULL THEN v_row->>'notes' ELSE housekeeping_note END,
        done = CASE WHEN v_kind IN ('vacant','ros') THEN done ELSE false END,
        guest_vacated = CASE WHEN guest_vacated AND (guest_vacated_at AT TIME ZONE 'Europe/London')::date = v_today THEN true ELSE false END,
        guest_vacated_at = CASE WHEN guest_vacated AND (guest_vacated_at AT TIME ZONE 'Europe/London')::date = v_today THEN guest_vacated_at ELSE NULL END,
        sheet_kind = v_kind,
        sheet_guests = coalesce((v_row->>'adults')::int,0) + coalesce((v_row->>'children')::int,0) + coalesce((v_row->>'infants')::int,0),
        sheet_bed = v_row->>'bed',
        sheet_room_type = v_row->>'room_type',
        updated_at = now()
      WHERE hotel_id=v_imp.hotel_id AND room_number=v_room;
      IF FOUND THEN
        v_count := v_count + 1;
        IF array_length(v_cot_keys, 1) > 0 THEN
          -- A cot is for the arrival day: one added by hand today for an arrival stays.
          DELETE FROM public.room_custom_flags
            WHERE hotel_id=v_imp.hotel_id AND room_number=v_room AND flag_key = ANY(v_cot_keys)
              AND NOT (v_arr AND (created_at AT TIME ZONE 'Europe/London')::date = v_today);
          IF v_cot THEN
            INSERT INTO public.room_custom_flags (hotel_id, room_number, flag_key)
              VALUES (v_imp.hotel_id, v_room, v_cot_keys[1])
              ON CONFLICT (hotel_id, room_number, flag_key) DO NOTHING;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.morning_sheet_imports SET status=CASE WHEN p_apply THEN 'applied' ELSE 'discarded' END,
    resolved_by=auth.uid(), resolved_by_name=p_name, resolved_at=now() WHERE id=p_import;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.resolve_morning_sheet(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_morning_sheet(uuid,boolean,text) TO authenticated, service_role;
