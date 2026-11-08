-- Rooms left dirty (0053): changing the status by hand now works.
-- Before, clearing a left-dirty room's status (Dirty → ROS → none) put Dirty
-- straight back, because the database couldn't tell that apart from Reset all.
-- Now there are three triggers, run in this order (by name):
--   1. a_reset: only Reset all writes the paperwork columns (sheet_kind) from
--      the apps, so when it clears the status of a room left dirty, Dirty goes
--      back on.
--   2. b_status: someone changes a room left dirty away from Dirty: it's no
--      longer left dirty.
--   3. c_done: the room is marked done (housekeeping or reception): cleaned at last.
DROP TRIGGER IF EXISTS trg_keep_left_dirty_rooms ON public.rooms;
DROP FUNCTION IF EXISTS public.keep_left_dirty_rooms();

CREATE OR REPLACE FUNCTION public.left_dirty_on_reset() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.left_dirty_at IS NOT NULL AND NEW.reception_status_id IS NULL AND OLD.reception_status_id IS NOT NULL THEN
  SELECT id INTO NEW.reception_status_id FROM public.reception_items
   WHERE hotel_id=NEW.hotel_id AND kind='status' AND lower(label)='dirty' LIMIT 1;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_left_dirty_a_reset ON public.rooms;
CREATE TRIGGER trg_left_dirty_a_reset BEFORE UPDATE OF sheet_kind ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.left_dirty_on_reset();

CREATE OR REPLACE FUNCTION public.left_dirty_on_status_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_dirty uuid;
BEGIN
 IF NEW.left_dirty_at IS NOT NULL AND NEW.reception_status_id IS DISTINCT FROM OLD.reception_status_id THEN
  SELECT id INTO v_dirty FROM public.reception_items
   WHERE hotel_id=NEW.hotel_id AND kind='status' AND lower(label)='dirty' LIMIT 1;
  IF OLD.reception_status_id = v_dirty AND NEW.reception_status_id IS DISTINCT FROM v_dirty THEN
   NEW.left_dirty_at := NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_left_dirty_b_status ON public.rooms;
CREATE TRIGGER trg_left_dirty_b_status BEFORE UPDATE OF reception_status_id ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.left_dirty_on_status_change();

CREATE OR REPLACE FUNCTION public.left_dirty_on_done() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.left_dirty_at IS NOT NULL AND (
     (COALESCE(NEW.done,false) AND NOT COALESCE(OLD.done,false))
  OR (COALESCE(NEW.done_reception,false) AND NOT COALESCE(OLD.done_reception,false))) THEN
  NEW.left_dirty_at := NULL;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_left_dirty_c_done ON public.rooms;
CREATE TRIGGER trg_left_dirty_c_done BEFORE UPDATE OF done, done_reception ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.left_dirty_on_done();
