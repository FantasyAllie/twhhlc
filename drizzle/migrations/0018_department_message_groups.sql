ALTER TABLE public.room_messages ADD COLUMN group_key text;
UPDATE public.room_messages SET group_key = CASE WHEN thread LIKE '%reception%' THEN 'reception' WHEN thread LIKE '%maintenance%' THEN 'maintenance' ELSE 'housekeeping' END;
ALTER TABLE public.room_messages ADD CONSTRAINT room_messages_group_key_check CHECK (group_key IN ('housekeeping','reception','fnb','maintenance'));
COMMENT ON COLUMN public.room_messages.thread IS 'DEPRECATED for chat routing: use group_key; retained for historical maintenance-log messages and older clients.';
CREATE OR REPLACE FUNCTION private.can_access_message_group(p_group text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT private.is_approved(auth.uid()) AND (p_group = 'reception' OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'manager') OR private.has_role(auth.uid(), 'developer') OR private.has_role(auth.uid(), 'regional_admin') OR private.has_role(auth.uid(), CASE p_group WHEN 'housekeeping' THEN 'housekeeper' WHEN 'fnb' THEN 'fnb' WHEN 'maintenance' THEN 'maintenance' ELSE 'pending' END::public.app_role));
$$;
GRANT EXECUTE ON FUNCTION private.can_access_message_group(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.assign_message_group_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.group_key IS NULL THEN NEW.group_key := CASE WHEN NEW.thread LIKE '%reception%' THEN 'reception' WHEN NEW.thread LIKE '%maintenance%' THEN 'maintenance' ELSE 'housekeeping' END; END IF;
  IF auth.uid() IS NOT NULL THEN
   NEW.user_id := auth.uid();
   SELECT COALESCE(NULLIF(display_name,''),NULLIF(split_part(email,'@',1),''),'Staff') INTO NEW.created_by_username FROM public.profiles WHERE id=auth.uid();
   NEW.created_by_username := COALESCE(NEW.created_by_username,'Staff');
  END IF;
 ELSIF auth.uid() IS NOT NULL THEN
  NEW.group_key := OLD.group_key;
  NEW.user_id := OLD.user_id;
  NEW.created_by_username := OLD.created_by_username;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER assign_message_group_identity BEFORE INSERT OR UPDATE ON public.room_messages FOR EACH ROW EXECUTE FUNCTION public.assign_message_group_identity();
ALTER POLICY "Approved users full access" ON public.room_messages USING (private.can_access_hotel(hotel_id) AND private.can_access_message_group(group_key)) WITH CHECK (private.can_access_hotel(hotel_id) AND private.can_access_message_group(group_key));