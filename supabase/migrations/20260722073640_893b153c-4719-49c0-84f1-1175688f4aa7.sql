ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS guest_vacated_at timestamptz,
  ADD COLUMN IF NOT EXISTS early_check_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_maintenance_at timestamptz;

UPDATE public.rooms SET guest_vacated_at = now() WHERE guest_vacated = true AND guest_vacated_at IS NULL;
UPDATE public.rooms SET early_check_in_at = now() WHERE early_check_in = true AND early_check_in_at IS NULL;
UPDATE public.rooms SET needs_maintenance_at = now() WHERE needs_maintenance = true AND needs_maintenance_at IS NULL;