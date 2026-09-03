ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS dog_box boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dog_box_at timestamptz;