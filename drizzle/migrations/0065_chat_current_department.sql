-- Hotel chat: a new message shows the department its sender is working as
-- ("Sam · Reception"), not every department they belong to. The apps and the
-- website send that one department in created_by_departments; it's kept only
-- when it really is one of the sender's departments. Anything else (an older
-- app, or no department sent) falls back to all of them, as before.
-- Developer accounts still show by name only.
CREATE OR REPLACE FUNCTION public.assign_message_group_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 mine text[];
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.group_key IS NULL THEN NEW.group_key := CASE WHEN NEW.thread LIKE '%reception%' THEN 'reception' WHEN NEW.thread LIKE '%maintenance%' THEN 'maintenance' ELSE 'housekeeping' END; END IF;
  IF auth.uid() IS NOT NULL THEN
   NEW.user_id := auth.uid();
   SELECT COALESCE(NULLIF(display_name,''),NULLIF(split_part(email,'@',1),''),'Staff') INTO NEW.created_by_username FROM public.profiles WHERE id=auth.uid();
   NEW.created_by_username := COALESCE(NEW.created_by_username,'Staff');
   IF private.has_role(auth.uid(), 'developer') THEN
    NEW.created_by_departments := '{}'::text[];
   ELSE
    mine := private.user_departments(auth.uid());
    IF coalesce(array_length(NEW.created_by_departments, 1), 0) = 1 AND NEW.created_by_departments[1] = ANY(mine) THEN
     NEW.created_by_departments := ARRAY[NEW.created_by_departments[1]];
    ELSE
     NEW.created_by_departments := mine;
    END IF;
   END IF;
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
