
CREATE TABLE public.maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  room_number INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_by_username TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  done_by_username TEXT,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_requests TO authenticated;
GRANT ALL ON public.maintenance_requests TO service_role;

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access"
  ON public.maintenance_requests
  TO authenticated
  USING (private.is_approved(auth.uid()))
  WITH CHECK (private.is_approved(auth.uid()));

CREATE INDEX maintenance_requests_open_idx
  ON public.maintenance_requests (created_at DESC) WHERE done = false;

CREATE TRIGGER update_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_requests;
