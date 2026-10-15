ALTER TABLE public.rooms ADD COLUMN checked_items jsonb;
COMMENT ON COLUMN public.rooms.checked_items IS 'Optional current room item selection; null means the checklist has not been used. Completion history remains immutable.';
UPDATE public.rooms r SET checked_items = c.items FROM (SELECT DISTINCT ON (hotel_id,room_number) hotel_id,room_number,items FROM public.room_checklist_completions ORDER BY hotel_id,room_number,completed_at DESC) c WHERE r.hotel_id=c.hotel_id AND r.room_number=c.room_number;
CREATE OR REPLACE FUNCTION public.set_room_checked_item(p_room_number integer, p_item text, p_selected boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hotel uuid := private.current_hotel_id(); v_expected jsonb; v_items jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_hotel) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 SELECT items INTO v_expected FROM public.room_checklist_settings WHERE hotel_id=v_hotel;
 v_expected:=coalesce(v_expected,'["TV Remote","Fan","Water"]'::jsonb);
 IF p_item IS NULL OR p_selected IS NULL OR NOT v_expected @> jsonb_build_array(p_item) THEN RAISE EXCEPTION 'Item list changed. Please refresh.'; END IF;
 SELECT coalesce(checked_items,'[]'::jsonb) INTO v_items FROM public.rooms WHERE hotel_id=v_hotel AND room_number=p_room_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room is no longer available'; END IF;
 SELECT coalesce(jsonb_agg(e.value),'[]'::jsonb) INTO v_items FROM jsonb_array_elements(v_expected) e WHERE (v_items @> jsonb_build_array(e.value) AND e.value<>to_jsonb(p_item)) OR (p_selected AND e.value=to_jsonb(p_item));
 UPDATE public.rooms SET checked_items=v_items, updated_at=now() WHERE hotel_id=v_hotel AND room_number=p_room_number;
 RETURN v_items;
END $$;
REVOKE ALL ON FUNCTION public.set_room_checked_item(integer,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_room_checked_item(integer,text,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.complete_selected_room_items(p_room_number integer,p_department text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hotel uuid := private.current_hotel_id(); v_items jsonb; v_expected jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_hotel) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 SELECT checked_items INTO v_items FROM public.rooms WHERE hotel_id=v_hotel AND room_number=p_room_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room is no longer available'; END IF;
 SELECT items INTO v_expected FROM public.room_checklist_settings WHERE hotel_id=v_hotel;
 v_expected:=coalesce(v_expected,'["TV Remote","Fan","Water"]'::jsonb);
 SELECT coalesce(jsonb_agg(e.value),'[]'::jsonb) INTO v_items FROM jsonb_array_elements(v_expected) e WHERE v_items @> jsonb_build_array(e.value);
 RETURN public.complete_room_checklist(p_room_number,p_department,v_items);
END $$;
REVOKE ALL ON FUNCTION public.complete_selected_room_items(integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_selected_room_items(integer,text) TO authenticated,service_role;