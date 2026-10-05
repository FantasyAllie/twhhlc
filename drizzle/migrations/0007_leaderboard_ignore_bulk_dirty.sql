-- Remove past bulk resets: room_dirty bursts (3+ by same user within 5s)
DELETE FROM public.activity_events a
WHERE a.kind = 'room_dirty'
  AND (SELECT count(*) FROM public.activity_events b
       WHERE b.kind = 'room_dirty' AND b.hotel_id = a.hotel_id
         AND b.username IS NOT DISTINCT FROM a.username
         AND b.created_at BETWEEN a.created_at - interval '5 seconds' AND a.created_at + interval '5 seconds') >= 3;

CREATE OR REPLACE FUNCTION public.track_room_activity()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE recent integer;
BEGIN
  IF NEW.done IS DISTINCT FROM OLD.done THEN
    IF NOT NEW.done THEN
      SELECT count(*) INTO recent FROM public.activity_events
        WHERE hotel_id = NEW.hotel_id AND kind IN ('room_dirty','room_dirty_bulk')
          AND user_id IS NOT DISTINCT FROM auth.uid()
          AND created_at > now() - interval '5 seconds';
      IF recent >= 2 THEN
        -- Bulk reset in progress: don't count it on the leaderboard
        UPDATE public.activity_events SET kind = 'room_dirty_bulk'
          WHERE hotel_id = NEW.hotel_id AND kind = 'room_dirty'
            AND user_id IS NOT DISTINCT FROM auth.uid()
            AND created_at > now() - interval '5 seconds';
        PERFORM private.log_activity(NEW.hotel_id, 'room_dirty_bulk', NEW.room_number, 1);
        RETURN NEW;
      END IF;
    END IF;
    PERFORM private.log_activity(NEW.hotel_id, CASE WHEN NEW.done THEN 'room_clean' ELSE 'room_dirty' END, NEW.room_number, 1);
  END IF;
  RETURN NEW;
END $function$;