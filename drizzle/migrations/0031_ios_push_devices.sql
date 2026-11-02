CREATE TABLE IF NOT EXISTS public.ios_push_devices (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  bundle_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ios_push_devices_user_id_idx ON public.ios_push_devices (user_id);

-- Only the server reads and writes these, through its service role.
ALTER TABLE public.ios_push_devices ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ios_push_devices TO service_role;