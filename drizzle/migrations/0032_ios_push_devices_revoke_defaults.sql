-- Supabase's default privileges on the public schema handed anon and
-- authenticated table-level rights on ios_push_devices. Nothing uses them:
-- every read and write goes through the server's service-role client, and
-- row-level security is enabled with no policies. TRUNCATE is not gated by
-- row-level security, so leaving the grant in place would let any signed-in
-- user wipe the device list. Keep the table server-only.
REVOKE ALL ON public.ios_push_devices FROM anon, authenticated;
GRANT ALL ON public.ios_push_devices TO service_role;