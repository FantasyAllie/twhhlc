CREATE OR REPLACE FUNCTION public.complete_room_checklist(p_room_number integer, p_department text, p_items jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hotel uuid := private.current_hotel_id(); v_expected jsonb; v_id uuid; v_name text;
BEGIN
 IF NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_hotel) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 IF p_department NOT IN ('housekeeping','reception') THEN RAISE EXCEPTION 'Invalid department'; END IF;
 IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Invalid checklist'; END IF;
 SELECT items INTO v_expected FROM public.room_checklist_settings WHERE hotel_id = v_hotel;
 v_expected := coalesce(v_expected, '["TV Remote","Fan","Water"]'::jsonb);
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) e WHERE NOT v_expected @> jsonb_build_array(e)) THEN RAISE EXCEPTION 'Checklist changed. Please reopen the checklist.'; END IF;
 UPDATE public.rooms SET done = CASE WHEN p_department='housekeeping' THEN true ELSE done END, done_reception = CASE WHEN p_department='reception' THEN true ELSE done_reception END, guest_vacated=false, guest_vacated_at=null, early_check_in=false, early_check_in_at=null, late_checkout=false, late_checkout_at=null, stayover_out=false, stayover_out_at=null, updated_at=now() WHERE hotel_id=v_hotel AND room_number=p_room_number;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room is no longer available'; END IF;
 SELECT coalesce(display_name,email) INTO v_name FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.room_checklist_completions(hotel_id,room_number,department,items,completed_by_name) VALUES(v_hotel,p_room_number,p_department,p_items,v_name) RETURNING id INTO v_id;
 RETURN v_id;
END $$;