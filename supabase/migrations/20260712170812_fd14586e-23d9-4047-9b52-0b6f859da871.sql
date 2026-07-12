-- =========================================================================
-- Multi-hotel workspaces: foundation
-- =========================================================================

-- 1) Add regional_admin to the app_role enum (usable after this migration commits;
--    we only reference it via ::text comparison so the enum literal isn't needed here).
alter type public.app_role add value if not exists 'regional_admin';

-- 2) hotels
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.hotels to authenticated;
grant all on public.hotels to service_role;
alter table public.hotels enable row level security;

drop policy if exists "Approved users can read hotels" on public.hotels;
create policy "Approved users can read hotels" on public.hotels
  for select to authenticated
  using (private.is_approved(auth.uid()));

drop policy if exists "Regional admins manage hotels" on public.hotels;
create policy "Regional admins manage hotels" on public.hotels
  for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'regional_admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'regional_admin'));

create trigger hotels_set_updated_at before update on public.hotels
  for each row execute function public.update_updated_at_column();

-- 3) hotel_members (one hotel per user for now; unique on user_id enforces that)
create table if not exists public.hotel_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists hotel_members_hotel_id_idx on public.hotel_members(hotel_id);
grant select on public.hotel_members to authenticated;
grant all on public.hotel_members to service_role;
alter table public.hotel_members enable row level security;

drop policy if exists "Users read own membership" on public.hotel_members;
create policy "Users read own membership" on public.hotel_members
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Regional admins manage memberships" on public.hotel_members;
create policy "Regional admins manage memberships" on public.hotel_members
  for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'regional_admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'regional_admin'));

-- 4) user_active_hotel (which hotel a regional admin is currently switched into)
create table if not exists public.user_active_hotel (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_active_hotel to authenticated;
grant all on public.user_active_hotel to service_role;
alter table public.user_active_hotel enable row level security;

drop policy if exists "Users manage own active hotel" on public.user_active_hotel;
create policy "Users manage own active hotel" on public.user_active_hotel
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) Helper functions (private schema, security definer)
create or replace function private.is_regional_admin(_uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role::text = 'regional_admin'
  )
$$;

create or replace function private.user_home_hotel(_uid uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select hotel_id from public.hotel_members where user_id = _uid
$$;

create or replace function private.current_hotel_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select hotel_id from public.user_active_hotel where user_id = auth.uid()),
    (select hotel_id from public.hotel_members where user_id = auth.uid())
  )
$$;

create or replace function private.can_access_hotel(_hotel_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select
    private.is_regional_admin(auth.uid())
    and _hotel_id = coalesce(
      (select hotel_id from public.user_active_hotel where user_id = auth.uid()),
      _hotel_id  -- regional admin without active hotel selection sees all
    )
    or _hotel_id = (select hotel_id from public.hotel_members where user_id = auth.uid())
$$;

grant execute on function private.is_regional_admin(uuid) to authenticated, service_role;
grant execute on function private.user_home_hotel(uuid) to authenticated, service_role;
grant execute on function private.current_hotel_id() to authenticated, service_role;
grant execute on function private.can_access_hotel(uuid) to authenticated, service_role;

-- 6) Seed the existing property and assign all existing users to it
insert into public.hotels (name, slug, timezone)
values ('Three Ways House Hotel', 'three-ways-house', 'Europe/London')
on conflict (slug) do nothing;

insert into public.hotel_members (user_id, hotel_id)
select p.id, h.id
from public.profiles p
cross join public.hotels h
where h.slug = 'three-ways-house'
on conflict (user_id) do nothing;

-- 7) Add hotel_id column to every tenant table, backfill, set NOT NULL, index
do $$
declare
  t text;
  hid uuid;
  tables text[] := array[
    'rooms','room_types','room_features','room_feature_rooms',
    'template_items','template_item_rooms','room_extra_items',
    'room_item_counts','reject_counts','room_messages','lost_property',
    'maintenance_requests','reception_items','fnb_linen_counts',
    'stayover_photos','export_snapshots'
  ];
begin
  select id into hid from public.hotels where slug = 'three-ways-house';
  foreach t in array tables loop
    execute format('alter table public.%I add column if not exists hotel_id uuid references public.hotels(id)', t);
    execute format('update public.%I set hotel_id = %L where hotel_id is null', t, hid);
    execute format('alter table public.%I alter column hotel_id set not null', t);
    execute format('create index if not exists %I on public.%I(hotel_id)', t || '_hotel_id_idx', t);
  end loop;
end $$;

-- 8) Rewrite RLS policies to include the hotel-access check.

-- 8a) Simple "Approved users full access" tables (all-in-one policy)
do $$
declare
  t text;
  tables text[] := array[
    'rooms','room_types','room_features','room_feature_rooms',
    'template_items','template_item_rooms','room_extra_items',
    'room_item_counts','reject_counts','room_messages','lost_property',
    'maintenance_requests','reception_items','export_snapshots'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "Approved users full access" on public.%I', t);
    execute format($p$create policy "Approved users full access" on public.%I
      for all to authenticated
      using (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id))
      with check (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id))$p$, t);
  end loop;
end $$;

-- 8b) fnb_linen_counts (split policies)
drop policy if exists "Approved users can read F&B counts" on public.fnb_linen_counts;
create policy "Approved users can read F&B counts" on public.fnb_linen_counts
  for select to authenticated
  using (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id));

drop policy if exists "Approved users can insert F&B counts" on public.fnb_linen_counts;
create policy "Approved users can insert F&B counts" on public.fnb_linen_counts
  for insert to authenticated
  with check (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id));

drop policy if exists "Approved users can update F&B counts" on public.fnb_linen_counts;
create policy "Approved users can update F&B counts" on public.fnb_linen_counts
  for update to authenticated
  using (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id))
  with check (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id));

drop policy if exists "Admins/managers can delete F&B counts" on public.fnb_linen_counts;
create policy "Admins/managers can delete F&B counts" on public.fnb_linen_counts
  for delete to authenticated
  using (
    (private.has_role(auth.uid(), 'admin'::public.app_role)
      or private.has_role(auth.uid(), 'manager'::public.app_role))
    and private.can_access_hotel(hotel_id)
  );

-- 8c) stayover_photos (split policies, retain approval check)
drop policy if exists "Approved users can view stayover photos" on public.stayover_photos;
create policy "Approved users can view stayover photos" on public.stayover_photos
  for select to authenticated
  using (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id));

drop policy if exists "Approved users can add stayover photos" on public.stayover_photos;
create policy "Approved users can add stayover photos" on public.stayover_photos
  for insert to authenticated
  with check (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id));

drop policy if exists "Approved users can delete stayover photos" on public.stayover_photos;
create policy "Approved users can delete stayover photos" on public.stayover_photos
  for delete to authenticated
  using (private.is_approved(auth.uid()) and private.can_access_hotel(hotel_id));

-- 8d) room_features already covered in 8a via loop (removed duplicate)

-- 9) Update handle_new_user so admin-created accounts can be placed in a specific hotel
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  initial_role public.app_role;
  target_hotel_id uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  if lower(new.email) = 'fantasyallie@icloud.com' then
    initial_role := 'admin';
  else
    initial_role := 'pending';
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, initial_role)
  on conflict (user_id, role) do nothing;

  -- Prefer explicit hotel_id passed in user_metadata; else default to Three Ways House.
  begin
    target_hotel_id := nullif(new.raw_user_meta_data->>'hotel_id', '')::uuid;
  exception when others then
    target_hotel_id := null;
  end;

  if target_hotel_id is null then
    select id into target_hotel_id from public.hotels where slug = 'three-ways-house' limit 1;
  end if;

  if target_hotel_id is not null then
    insert into public.hotel_members (user_id, hotel_id)
    values (new.id, target_hotel_id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;