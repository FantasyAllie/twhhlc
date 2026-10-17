-- Display photos: any signed-in user can view; each user can only write the file named after their own username.
create policy "avatars read signed in"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "avatars insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name = lower(trim((select p.display_name from public.profiles p where p.id = auth.uid()))) || '.jpg'
  );

create policy "avatars update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and name = lower(trim((select p.display_name from public.profiles p where p.id = auth.uid()))) || '.jpg'
  );

create policy "avatars delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and name = lower(trim((select p.display_name from public.profiles p where p.id = auth.uid()))) || '.jpg'
  );
