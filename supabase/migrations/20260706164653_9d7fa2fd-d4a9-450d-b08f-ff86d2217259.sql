
-- 1) New role: maintenance
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'maintenance';

-- 2) Extend room_messages.thread CHECK to include maintenance threads
ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS room_messages_thread_check;
ALTER TABLE public.room_messages
  ADD CONSTRAINT room_messages_thread_check
  CHECK (thread IN ('hk_reception', 'hk_fnb', 'reception_fnb', 'hk_maintenance', 'reception_maintenance'));

-- 3) Add origin_department + deleted_at to maintenance_requests
ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS origin_department TEXT
    CHECK (origin_department IS NULL OR origin_department IN ('housekeeping','reception','fnb')),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4) Lost Property table
CREATE TABLE IF NOT EXISTS public.lost_property (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number INTEGER,
  message TEXT NOT NULL,
  created_by_username TEXT,
  created_by_role TEXT
    CHECK (created_by_role IS NULL OR created_by_role IN ('housekeeping','reception','fnb','maintenance','admin','manager')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','collected','discarded')),
  resolved_by_username TEXT,
  resolved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lost_property TO authenticated;
GRANT ALL ON public.lost_property TO service_role;

ALTER TABLE public.lost_property ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users full access" ON public.lost_property;
CREATE POLICY "Approved users full access"
  ON public.lost_property
  TO authenticated
  USING (private.is_approved(auth.uid()))
  WITH CHECK (private.is_approved(auth.uid()));

CREATE INDEX IF NOT EXISTS lost_property_open_idx
  ON public.lost_property (created_at DESC) WHERE status = 'open' AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_lost_property_updated_at ON public.lost_property;
CREATE TRIGGER update_lost_property_updated_at
  BEFORE UPDATE ON public.lost_property
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_property;
