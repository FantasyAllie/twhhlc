CREATE POLICY "hotel branding read same hotel"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hotel-branding'
  AND private.can_access_hotel(((storage.foldername(name))[1])::uuid)
);