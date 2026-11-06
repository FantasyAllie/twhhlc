-- One chat for the whole hotel ('hotel'), replacing the department group chats
-- in the apps. Every approved member of the hotel can read and post in it, and
-- each message keeps its sender's departments so it can show "Sarah · Reception".
-- The old department chats stay in the database, unused by the apps.
ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS room_messages_group_key_check;
ALTER TABLE public.room_messages ADD CONSTRAINT room_messages_group_key_check
 CHECK (group_key IN ('housekeeping','reception','fnb','maintenance','hotel'));
ALTER TABLE public.room_messages ADD COLUMN created_by_departments text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION private.can_access_message_group(p_group text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT private.is_approved(auth.uid()) AND (p_group IN ('reception','hotel') OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'manager') OR private.has_role(auth.uid(), 'developer') OR private.has_role(auth.uid(), 'regional_admin') OR private.has_role(auth.uid(), CASE p_group WHEN 'housekeeping' THEN 'housekeeper' WHEN 'fnb' THEN 'fnb' WHEN 'maintenance' THEN 'maintenance' ELSE 'pending' END::public.app_role));
$$;

CREATE OR REPLACE FUNCTION public.assign_message_group_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.group_key IS NULL THEN NEW.group_key := CASE WHEN NEW.thread LIKE '%reception%' THEN 'reception' WHEN NEW.thread LIKE '%maintenance%' THEN 'maintenance' ELSE 'housekeeping' END; END IF;
  IF auth.uid() IS NOT NULL THEN
   NEW.user_id := auth.uid();
   SELECT COALESCE(NULLIF(display_name,''),NULLIF(split_part(email,'@',1),''),'Staff') INTO NEW.created_by_username FROM public.profiles WHERE id=auth.uid();
   NEW.created_by_username := COALESCE(NEW.created_by_username,'Staff');
   -- Developer accounts sit in every department, so they show by name only.
   NEW.created_by_departments := CASE WHEN private.has_role(auth.uid(), 'developer') THEN '{}'::text[] ELSE private.user_departments(auth.uid()) END;
  END IF;
 ELSIF auth.uid() IS NOT NULL THEN
  NEW.group_key := OLD.group_key;
  NEW.user_id := OLD.user_id;
  NEW.created_by_username := OLD.created_by_username;
  NEW.created_by_departments := OLD.created_by_departments;
 END IF;
 RETURN NEW;
END;
$$;
