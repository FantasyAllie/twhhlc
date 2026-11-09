-- Android phones that get push notifications through Firebase Cloud Messaging,
-- alongside ios_push_devices (Apple) and push_subscriptions (browsers).
-- A token belongs to whoever signed in on that phone last. Like the iPhone
-- table, only the server reads and writes it, through its service role.
CREATE TABLE IF NOT EXISTS public.android_push_devices (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS android_push_devices_user_id_idx ON public.android_push_devices (user_id);

ALTER TABLE public.android_push_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.android_push_devices FROM anon, authenticated;
GRANT ALL ON public.android_push_devices TO service_role;
