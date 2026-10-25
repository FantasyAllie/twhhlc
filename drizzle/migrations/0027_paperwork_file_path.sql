-- Keep the original uploaded PDF so staff can reopen it later.
ALTER TABLE public.morning_sheet_imports ADD COLUMN file_path text;

-- Storage policies for the private 'paperwork' bucket; files are stored as
-- '<hotel_id>/<unique>-<filename>' so access is scoped per hotel.
CREATE POLICY "paperwork read hotel staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'paperwork' AND private.is_approved(auth.uid()) AND private.can_access_hotel((split_part(name, '/', 1))::uuid));

CREATE POLICY "paperwork insert hotel staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'paperwork' AND private.is_approved(auth.uid()) AND private.can_access_hotel((split_part(name, '/', 1))::uuid));