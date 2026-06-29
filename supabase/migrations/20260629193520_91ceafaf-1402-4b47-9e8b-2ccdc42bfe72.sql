-- 1) Drop legacy app_users table (contains password hashes, no longer used by app)
DROP TABLE IF EXISTS public.app_users CASCADE;

-- 2) Remove client-accessible policies on server-only tables
DROP POLICY IF EXISTS "Users manage own prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users manage own push" ON public.push_subscriptions;
REVOKE ALL ON public.notification_preferences FROM anon, authenticated;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;

-- 3) Move SECURITY DEFINER role-check helpers out of the public (Data API) schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Recreate has_role and is_approved in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager','user','reception')
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_approved(uuid) TO authenticated, service_role;

-- 4) Recreate policies to reference private.* helpers
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rooms','room_messages','room_item_counts','reject_counts','template_items',
    'template_item_rooms','room_extra_items','room_features','room_feature_rooms',
    'room_types','reception_items','export_snapshots'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Approved users full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Approved users full access" ON public.%I FOR ALL TO authenticated USING (private.is_approved(auth.uid())) WITH CHECK (private.is_approved(auth.uid()))',
      t
    );
  END LOOP;
END $$;

-- 5) Drop the public-schema (Data API exposed) versions of these SECURITY DEFINER fns
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_approved(uuid);