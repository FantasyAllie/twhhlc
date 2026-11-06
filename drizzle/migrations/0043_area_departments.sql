-- Public & hotel areas can be limited to departments: only those departments see
-- the area in the maintenance and lost property location lists. Empty means every
-- department. Managers and admins always see every area.
ALTER TABLE public.maintenance_areas ADD COLUMN departments text[] NOT NULL DEFAULT '{}'
 CHECK (departments <@ ARRAY['housekeeping','reception','fnb','maintenance']::text[]);
