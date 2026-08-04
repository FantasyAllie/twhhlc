ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS not_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS not_required_at timestamp with time zone;