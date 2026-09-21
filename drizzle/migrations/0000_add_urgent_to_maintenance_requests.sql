ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;