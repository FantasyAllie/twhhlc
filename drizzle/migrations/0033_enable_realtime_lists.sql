-- These tables are listened to for live changes but were never published.
-- One unpublished table makes Realtime reject every subscription on its channel,
-- which stopped the website's and the iPhone app's live room updates.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hotel_floors', 'reception_items', 'template_items'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
