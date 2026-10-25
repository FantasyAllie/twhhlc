-- Hotel staff may remove paperwork files they can read.
CREATE POLICY "paperwork delete hotel staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'paperwork' AND private.is_approved(auth.uid()) AND private.can_access_hotel((split_part(name, '/', 1))::uuid));