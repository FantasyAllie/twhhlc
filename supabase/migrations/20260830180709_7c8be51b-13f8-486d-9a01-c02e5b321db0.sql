ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS stayover_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stayover_out_at timestamp with time zone;