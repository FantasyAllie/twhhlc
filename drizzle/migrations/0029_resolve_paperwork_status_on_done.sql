CREATE OR REPLACE FUNCTION public.resolve_paperwork_status_on_done()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dirty_id uuid;
  target_id uuid;
BEGIN
  IF NEW.sheet_kind NOT IN ('departure','turnover') THEN RETURN NEW; END IF;
  IF NOT ((NEW.done AND NOT COALESCE(OLD.done,false)) OR (NEW.done_reception AND NOT COALESCE(OLD.done_reception,false))) THEN
    RETURN NEW;
  END IF;
  SELECT id INTO dirty_id FROM public.reception_items
    WHERE kind='status' AND lower(label)='dirty' AND hotel_id IS NOT DISTINCT FROM NEW.hotel_id LIMIT 1;
  IF dirty_id IS NULL OR COALESCE(NEW.reception_status_id::text, NEW.default_status) IS DISTINCT FROM dirty_id::text THEN
    RETURN NEW;
  END IF;
  SELECT id INTO target_id FROM public.reception_items
    WHERE kind='status' AND hotel_id IS NOT DISTINCT FROM NEW.hotel_id
      AND lower(label) = CASE WHEN NEW.sheet_kind='turnover' THEN 'arrival' ELSE 'clean' END
    LIMIT 1;
  IF target_id IS NOT NULL THEN NEW.reception_status_id := target_id; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_resolve_paperwork_status_on_done ON public.rooms;
CREATE TRIGGER trg_resolve_paperwork_status_on_done
BEFORE UPDATE OF done, done_reception ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.resolve_paperwork_status_on_done();