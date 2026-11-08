-- Fix for 0053: leaving rooms dirty failed with "COALESCE types uuid and text
-- cannot be matched", because a room's default status is stored as text while
-- today's status is an id. Both are compared as text now.
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
        OR EXISTS (SELECT 1 FROM public.reception_items s WHERE s.id::text = coalesce(r.reception_status_id::text, r.default_status)
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
