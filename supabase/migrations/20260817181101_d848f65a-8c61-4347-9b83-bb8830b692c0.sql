ALTER PUBLICATION supabase_realtime ADD TABLE public.reject_counts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_counts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_item_counts;
ALTER TABLE public.reject_counts REPLICA IDENTITY FULL;
ALTER TABLE public.delivery_counts REPLICA IDENTITY FULL;
ALTER TABLE public.room_item_counts REPLICA IDENTITY FULL;