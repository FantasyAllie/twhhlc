-- Floors: editable per-room label used to group rooms on the home screen.
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS floor text;
COMMENT ON COLUMN public.rooms.floor IS 'Floor label used to group rooms on the home screen; editable per room';

-- Sensible starting floors derived from room numbers (Ground 1-19, 20''s, 30''s, 40''s).
UPDATE public.rooms SET floor = CASE
  WHEN room_number < 20 THEN 'Ground Floor'
  WHEN room_number < 30 THEN '20''s'
  WHEN room_number < 40 THEN '30''s'
  WHEN room_number < 50 THEN '40''s'
  ELSE 'Floor ' || (room_number / 10)::text
END
WHERE floor IS NULL;
