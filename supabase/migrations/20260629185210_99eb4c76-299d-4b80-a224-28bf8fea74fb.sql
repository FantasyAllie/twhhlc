
-- Tighten SECURITY DEFINER fn execute grants
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Legacy app_users: lock it down (no longer used by app code after cutover)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users FROM anon, authenticated;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='app_users'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_users', p.policyname);
  END LOOP;
END $$;
-- No policies = no access for authenticated either; service_role retains access.
