ALTER TABLE public.rooms
  ADD COLUMN mattress_tracking boolean NOT NULL DEFAULT false,
  ADD COLUMN mattress_interval_months integer NOT NULL DEFAULT 3,
  ADD COLUMN mattress_flipped_at timestamptz,
  ADD COLUMN mattress_flipped_by text;