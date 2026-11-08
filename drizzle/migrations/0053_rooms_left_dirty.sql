-- Rooms left dirty: when housekeeping can't get to every room, the rooms left
-- can be marked "left dirty" (one at a time, or all the rest at once).
--   * rooms.left_dirty_at: when it was left. Cleared when the room is marked done
--     (by housekeeping or reception).
--   * Left today, the room no longer holds the shift open. From the next day it's
--     on the list to clean again, and Today's brief counts it.
--   * It shows Dirty until it's cleaned: the morning paperwork keeps it Dirty
--     (unless it's a stayover or out of service), and so does Reset all.
-- The paperwork function is as in 0051, with the Dirty status kept.
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS left_dirty_at timestamptz;

CREATE OR REPLACE FUNCTION public.resolve_morning_sheet(p_import uuid, p_apply boolean, p_name text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_imp public.morning_sheet_imports; v_row jsonb; v_status uuid; v_arrival uuid; v_bed uuid; v_count integer := 0; v_label text;
  v_kind text; v_notes text; v_room integer; v_arr boolean; v_dep boolean;
  v_dog boolean; v_eci boolean; v_lco boolean; v_cot boolean;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_cot_keys text[];
  v_dirty uuid;
BEGIN
  SELECT * INTO v_imp FROM public.morning_sheet_imports WHERE id=p_import FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Morning sheet not found'; END IF;
  IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_imp.hotel_id) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF v_imp.status<>'pending' THEN RAISE EXCEPTION 'This morning sheet has already been handled'; END IF;
  IF p_apply THEN
    SELECT id INTO v_arrival FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='status' AND lower(label)='arrival' LIMIT 1;
    SELECT id INTO v_dirty FROM public.reception_items WHERE hotel_id=v_imp.hotel_id AND kind='status' AND lower(label)='dirty' LIMIT 1;
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
        -- A room left dirty stays Dirty until it's cleaned, unless a guest is in it
        -- (stayover) or it's out of service.
        reception_status_id = CASE
          WHEN left_dirty_at IS NOT NULL AND NOT done AND v_kind NOT IN ('stayover','ros') AND v_dirty IS NOT NULL THEN v_dirty
          ELSE coalesce(v_status, reception_status_id) END,
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
        -- The room checklist is for getting a room ready for its next arrival, so
        -- it starts again only when the room is a departure; otherwise it's kept.
        guest_extras_done = CASE WHEN v_dep THEN NULL ELSE guest_extras_done END,
        guest_extras_guests = CASE WHEN v_dep THEN NULL ELSE guest_extras_guests END,
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


CREATE OR REPLACE FUNCTION public.keep_left_dirty_rooms() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.left_dirty_at IS NOT NULL THEN
  IF (COALESCE(NEW.done,false) AND NOT COALESCE(OLD.done,false))
     OR (COALESCE(NEW.done_reception,false) AND NOT COALESCE(OLD.done_reception,false)) THEN
   -- Cleaned at last.
   NEW.left_dirty_at := NULL;
  ELSIF NEW.reception_status_id IS NULL AND OLD.reception_status_id IS NOT NULL THEN
   -- Reset all clears every status; a room left dirty goes back to Dirty.
   SELECT id INTO NEW.reception_status_id FROM public.reception_items
    WHERE hotel_id=NEW.hotel_id AND kind='status' AND lower(label)='dirty' LIMIT 1;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_keep_left_dirty_rooms ON public.rooms;
CREATE TRIGGER trg_keep_left_dirty_rooms BEFORE UPDATE OF done, done_reception, reception_status_id ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.keep_left_dirty_rooms();

-- Marks rooms left dirty (p_on) or not. Rooms already done are skipped. Rooms
-- left dirty show Dirty, except stayovers and DND (a guest is still in them).
-- Returns how many rooms changed.
CREATE OR REPLACE FUNCTION public.set_rooms_left_dirty(p_rooms integer[], p_on boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hotel uuid := private.current_hotel_id(); v_dirty uuid; v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_hotel) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 IF p_rooms IS NULL OR p_on IS NULL THEN RETURN 0; END IF;
 IF p_on THEN
  SELECT id INTO v_dirty FROM public.reception_items WHERE hotel_id=v_hotel AND kind='status' AND lower(label)='dirty' LIMIT 1;
  UPDATE public.rooms r SET
    left_dirty_at = now(),
    reception_status_id = CASE
      WHEN v_dirty IS NULL OR coalesce(r.sheet_kind,'') = 'stayover'
        OR EXISTS (SELECT 1 FROM public.reception_items s WHERE s.id = coalesce(r.reception_status_id, r.default_status)
                   AND (lower(s.label) IN ('dnd','staff','ros','ros - staff','staff/ros') OR lower(s.label) LIKE 'stay%'))
      THEN r.reception_status_id ELSE v_dirty END,
    updated_at = now()
  WHERE r.hotel_id=v_hotel AND r.room_number = ANY(p_rooms) AND NOT coalesce(r.done,false) AND NOT coalesce(r.done_reception,false);
 ELSE
  UPDATE public.rooms SET left_dirty_at = NULL, updated_at = now()
  WHERE hotel_id=v_hotel AND room_number = ANY(p_rooms) AND left_dirty_at IS NOT NULL;
 END IF;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.set_rooms_left_dirty(integer[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_rooms_left_dirty(integer[],boolean) TO authenticated, service_role;
