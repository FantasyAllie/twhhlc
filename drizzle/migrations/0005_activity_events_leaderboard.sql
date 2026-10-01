CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid,
  username text,
  kind text NOT NULL,
  room_number integer,
  amount integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_hotel_time_idx ON public.activity_events (hotel_id, created_at);
GRANT SELECT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders read activity" ON public.activity_events FOR SELECT TO authenticated
USING (
  private.can_access_hotel(hotel_id) AND (
    private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'manager')
    OR private.has_role(auth.uid(), 'regional_admin') OR private.has_role(auth.uid(), 'developer')
  )
);

CREATE OR REPLACE FUNCTION private.log_activity(_hotel uuid, _kind text, _room integer, _amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); uname text;
BEGIN
  IF uid IS NULL OR _amount <= 0 THEN RETURN; END IF;
  SELECT coalesce(display_name, split_part(email,'@',1)) INTO uname FROM public.profiles WHERE id = uid;
  INSERT INTO public.activity_events (hotel_id, user_id, username, kind, room_number, amount)
  VALUES (_hotel, uid, uname, _kind, _room, _amount);
END $$;

CREATE OR REPLACE FUNCTION public.track_room_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.done IS DISTINCT FROM OLD.done THEN
    PERFORM private.log_activity(NEW.hotel_id, CASE WHEN NEW.done THEN 'room_clean' ELSE 'room_dirty' END, NEW.room_number, 1);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_track_room_activity AFTER UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.track_room_activity();

CREATE OR REPLACE FUNCTION public.track_linen_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE delta integer; room integer := NULL;
BEGIN
  delta := NEW.count - CASE WHEN TG_OP = 'UPDATE' THEN OLD.count ELSE 0 END;
  IF TG_TABLE_NAME = 'room_item_counts' THEN room := NEW.room_number; END IF;
  PERFORM private.log_activity(NEW.hotel_id, 'linen_counted', room, delta);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_track_linen_room AFTER INSERT OR UPDATE OF count ON public.room_item_counts
FOR EACH ROW EXECUTE FUNCTION public.track_linen_activity();
CREATE TRIGGER trg_track_linen_delivery AFTER INSERT OR UPDATE OF count ON public.delivery_counts
FOR EACH ROW EXECUTE FUNCTION public.track_linen_activity();
CREATE TRIGGER trg_track_linen_inventory AFTER INSERT OR UPDATE OF count ON public.inventory_counts
FOR EACH ROW EXECUTE FUNCTION public.track_linen_activity();
CREATE TRIGGER trg_track_linen_rejects AFTER INSERT OR UPDATE OF count ON public.reject_counts
FOR EACH ROW EXECUTE FUNCTION public.track_linen_activity();