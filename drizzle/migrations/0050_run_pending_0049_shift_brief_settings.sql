-- No schema change here. This marker exists only so Drizzle's migrator picks up and
-- applies the already-recorded migration 0049_shift_brief_settings exactly as written.
-- That migration creates public.shift_brief_settings (Today's brief tile visibility).
SELECT 1;