-- Merge orphan room rows (left over from when login was removed) into the shared user_id.
-- For each room_number, keep one row combining done=OR and most recent non-null category.
WITH merged AS (
  SELECT
    room_number,
    bool_or(done) AS done,
    (ARRAY_REMOVE(ARRAY_AGG(category ORDER BY updated_at DESC), NULL))[1] AS category
  FROM public.rooms
  GROUP BY room_number
)
DELETE FROM public.rooms;

INSERT INTO public.rooms (user_id, room_number, done, category)
SELECT '00000000-0000-0000-0000-000000000000'::uuid, room_number, done, category
FROM (
  SELECT
    room_number,
    bool_or(done) AS done,
    (ARRAY_REMOVE(ARRAY_AGG(category ORDER BY updated_at DESC), NULL))[1] AS category
  FROM (SELECT * FROM public.rooms) r
  GROUP BY room_number
) x;