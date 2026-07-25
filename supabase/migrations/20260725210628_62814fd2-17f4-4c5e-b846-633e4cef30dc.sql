-- Helper: resolve hotel ownership for an existing entry-photos object by path
create or replace function private.entry_photo_hotel_ok(_name text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select case
    when _name like 'lost_property/%' then exists (
      select 1 from public.lost_property lp
      where lp.id::text = split_part(_name, '/', 2)
        and private.can_access_hotel(lp.hotel_id)
    )
    when _name like 'maintenance/%' then exists (
      select 1 from public.maintenance_requests m
      where m.id::text = split_part(_name, '/', 2)
        and private.can_access_hotel(m.hotel_id)
    )
    when _name like 'stayover/%' then exists (
      select 1 from public.stayover_photos sp
      where sp.path = _name
        and private.can_access_hotel(sp.hotel_id)
    )
    else false
  end;
$$;

-- Helper: check hotel ownership at INSERT time, when the DB row may not exist yet
create or replace function private.entry_photo_insert_ok(_name text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select case
    when _name like 'lost_property/%' then exists (
      select 1 from public.lost_property lp
      where lp.id::text = split_part(_name, '/', 2)
        and private.can_access_hotel(lp.hotel_id)
    )
    when _name like 'maintenance/%' then exists (
      select 1 from public.maintenance_requests m
      where m.id::text = split_part(_name, '/', 2)
        and private.can_access_hotel(m.hotel_id)
    )
    when _name like 'stayover/%' then exists (
      select 1 from public.rooms r
      where r.room_number::text = split_part(_name, '/', 2)
        and private.can_access_hotel(r.hotel_id)
    )
    else false
  end;
$$;

-- Replace the existing entry-photos policies with hotel-scoped versions
drop policy if exists "entry-photos approved read"   on storage.objects;
drop policy if exists "entry-photos approved insert" on storage.objects;
drop policy if exists "entry-photos approved update" on storage.objects;
drop policy if exists "entry-photos approved delete" on storage.objects;

create policy "entry-photos hotel read"
  on storage.objects
  for select
  using (
    bucket_id = 'entry-photos'
    and private.is_approved(auth.uid())
    and private.entry_photo_hotel_ok(name)
  );

create policy "entry-photos hotel insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'entry-photos'
    and private.is_approved(auth.uid())
    and private.entry_photo_insert_ok(name)
  );

create policy "entry-photos hotel update"
  on storage.objects
  for update
  using (
    bucket_id = 'entry-photos'
    and private.is_approved(auth.uid())
    and private.entry_photo_hotel_ok(name)
  )
  with check (
    bucket_id = 'entry-photos'
    and private.is_approved(auth.uid())
    and private.entry_photo_hotel_ok(name)
  );

create policy "entry-photos hotel delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'entry-photos'
    and private.is_approved(auth.uid())
    and private.entry_photo_hotel_ok(name)
  );