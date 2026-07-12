
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'rooms','room_types','room_features','room_feature_rooms',
    'template_items','template_item_rooms','room_extra_items','room_item_counts',
    'reject_counts','room_messages','lost_property','maintenance_requests',
    'reception_items','fnb_linen_counts','stayover_photos','export_snapshots',
    'hotel_members'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_hotel_id_fkey');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE', t, t || '_hotel_id_fkey');
  END LOOP;
END $$;
