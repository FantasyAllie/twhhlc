CREATE TABLE public.room_checklist_settings (
 hotel_id uuid PRIMARY KEY DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 items jsonb NOT NULL DEFAULT '["TV Remote","Fan","Water"]'::jsonb,
 CHECK (jsonb_typeof(items) = 'array')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_checklist_settings TO authenticated;
GRANT ALL ON public.room_checklist_settings TO service_role;
ALTER TABLE public.room_checklist_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read checklist settings" ON public.room_checklist_settings FOR SELECT TO authenticated USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "Manage checklist settings" ON public.room_checklist_settings FOR ALL TO authenticated USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'regional_admin') OR private.has_role(auth.uid(),'developer'))) WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'regional_admin') OR private.has_role(auth.uid(),'developer')));
CREATE TABLE public.room_checklist_completions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 room_number integer NOT NULL,
 department text NOT NULL CHECK (department IN ('housekeeping','reception')),
 items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
 completed_by uuid NOT NULL DEFAULT auth.uid(),
 completed_by_name text,
 completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.room_checklist_completions TO authenticated;
GRANT ALL ON public.room_checklist_completions TO service_role;
ALTER TABLE public.room_checklist_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read completed room checklists" ON public.room_checklist_completions FOR SELECT TO authenticated USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE INDEX room_checklist_completions_room ON public.room_checklist_completions(hotel_id, room_number, completed_at DESC);
CREATE FUNCTION public.complete_room_checklist(p_room_number integer, p_department text, p_items jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hotel uuid := private.current_hotel_id(); v_expected jsonb; v_id uuid; v_name text;
BEGIN
 IF NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(v_hotel) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 IF p_department NOT IN ('housekeeping','reception') THEN RAISE EXCEPTION 'Invalid department'; END IF;
 SELECT items INTO v_expected FROM public.room_checklist_settings WHERE hotel_id = v_hotel;
 v_expected := coalesce(v_expected, '["TV Remote","Fan","Water"]'::jsonb);
 IF p_items IS DISTINCT FROM v_expected THEN RAISE EXCEPTION 'Checklist changed. Please reopen and complete the current checklist.'; END IF;
 UPDATE public.rooms SET done = CASE WHEN p_department='housekeeping' THEN true ELSE done END, done_reception = CASE WHEN p_department='reception' THEN true ELSE done_reception END, guest_vacated=false, guest_vacated_at=null, early_check_in=false, early_check_in_at=null, late_checkout=false, late_checkout_at=null, stayover_out=false, stayover_out_at=null, updated_at=now() WHERE hotel_id=v_hotel AND room_number=p_room_number AND CASE WHEN p_department='housekeeping' THEN NOT done ELSE NOT done_reception END;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room is already completed or no longer available'; END IF;
 SELECT coalesce(display_name,email) INTO v_name FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.room_checklist_completions(hotel_id,room_number,department,items,completed_by_name) VALUES(v_hotel,p_room_number,p_department,p_items,v_name) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.complete_room_checklist(integer,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_room_checklist(integer,text,jsonb) TO authenticated;
