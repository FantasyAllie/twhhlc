ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS reception_status_id uuid,
  ADD COLUMN IF NOT EXISTS reception_bed_id uuid;