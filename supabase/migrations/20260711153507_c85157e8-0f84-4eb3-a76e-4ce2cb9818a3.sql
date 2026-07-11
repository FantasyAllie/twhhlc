
ALTER TABLE public.lost_property
  ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL DEFAULT '{}';

CREATE POLICY "entry-photos authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'entry-photos');

CREATE POLICY "entry-photos authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'entry-photos');

CREATE POLICY "entry-photos authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'entry-photos')
  WITH CHECK (bucket_id = 'entry-photos');

CREATE POLICY "entry-photos authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'entry-photos');
