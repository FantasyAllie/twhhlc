
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_from_reception boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_from_housekeeping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_from_fnb boolean NOT NULL DEFAULT true;
