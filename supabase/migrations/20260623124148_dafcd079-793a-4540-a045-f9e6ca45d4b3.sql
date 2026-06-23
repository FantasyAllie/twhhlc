ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS housekeeping_note text,
  ADD COLUMN IF NOT EXISTS needs_maintenance boolean NOT NULL DEFAULT false;