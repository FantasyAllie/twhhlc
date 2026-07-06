ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_from_maintenance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_maintenance_requests boolean NOT NULL DEFAULT true;