ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS late_checkout boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_checkout_at timestamp with time zone;