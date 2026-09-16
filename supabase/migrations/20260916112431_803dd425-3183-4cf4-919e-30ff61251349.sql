ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_early_checkin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_late_checkout boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_stayover_out boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_dog_box boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_lost_property_logged boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_lost_property_collected boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_maintenance_completed boolean NOT NULL DEFAULT true;