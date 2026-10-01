CREATE OR REPLACE FUNCTION public.track_stayover_photo_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_events (hotel_id, user_id, username, kind, room_number, amount, created_at)
  VALUES (NEW.hotel_id, auth.uid(), NEW.created_by_username, 'stayover_photo', NEW.room_number, 1, NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_track_stayover_photo AFTER INSERT ON public.stayover_photos
FOR EACH ROW EXECUTE FUNCTION public.track_stayover_photo_activity();

INSERT INTO public.activity_events (hotel_id, username, kind, room_number, amount, created_at)
SELECT hotel_id, created_by_username, 'stayover_photo', room_number, 1, created_at FROM public.stayover_photos;