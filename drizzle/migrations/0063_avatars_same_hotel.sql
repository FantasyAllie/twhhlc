-- Display photos (the private "avatars" bucket, "<lowercased display name>.jpg").
-- Before: any signed-in account could open every photo, including a new
-- sign-up nobody had approved. Now: your own photo, plus the photos of people
-- who share a hotel you can open, for approved accounts only.
DROP POLICY IF EXISTS "avatars read signed in" ON storage.objects;
DROP POLICY IF EXISTS "avatars read same hotel" ON storage.objects;
CREATE POLICY "avatars read same hotel"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      name = lower(trim((SELECT p.display_name FROM public.profiles p WHERE p.id = auth.uid()))) || '.jpg'
      OR (
        private.is_approved(auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          JOIN public.hotel_members m ON m.user_id = p.id
          WHERE lower(trim(p.display_name)) || '.jpg' = storage.objects.name
            AND private.can_access_hotel(m.hotel_id)
        )
      )
    )
  );

-- Photos are named after display names, which aren't unique. Only someone
-- whose name nobody else uses can save or remove that photo, so one person
-- can't replace another's by taking the same name.
DROP POLICY IF EXISTS "avatars insert own" ON storage.objects;
CREATE POLICY "avatars insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name = lower(trim((SELECT p.display_name FROM public.profiles p WHERE p.id = auth.uid()))) || '.jpg'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles o
      WHERE o.id <> auth.uid() AND lower(trim(o.display_name)) || '.jpg' = storage.objects.name
    )
  );
DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name = lower(trim((SELECT p.display_name FROM public.profiles p WHERE p.id = auth.uid()))) || '.jpg'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles o
      WHERE o.id <> auth.uid() AND lower(trim(o.display_name)) || '.jpg' = storage.objects.name
    )
  );
DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name = lower(trim((SELECT p.display_name FROM public.profiles p WHERE p.id = auth.uid()))) || '.jpg'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles o
      WHERE o.id <> auth.uid() AND lower(trim(o.display_name)) || '.jpg' = storage.objects.name
    )
  );
