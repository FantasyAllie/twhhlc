-- 1. Allow multi-hotel membership
ALTER TABLE public.hotel_members DROP CONSTRAINT hotel_members_pkey;
ALTER TABLE public.hotel_members ADD PRIMARY KEY (user_id, hotel_id);
CREATE INDEX IF NOT EXISTS hotel_members_user_id_idx ON public.hotel_members(user_id);
CREATE INDEX IF NOT EXISTS hotel_members_hotel_id_idx ON public.hotel_members(hotel_id);

-- 2. is_approved: include maintenance + regional_admin
CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('regional_admin','admin','manager','user','reception','housekeeper','fnb','maintenance')
  )
$function$;

-- 3. current_hotel_id: use active hotel only; users must pick at login.
CREATE OR REPLACE FUNCTION private.current_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT hotel_id FROM public.user_active_hotel WHERE user_id = auth.uid()
$function$;

-- 4. can_access_hotel: strict active-hotel isolation.
-- A user only sees rows in their active hotel. If active hotel is not yet set
-- (e.g. right after signup), regional admins see everything; others see nothing.
CREATE OR REPLACE FUNCTION private.can_access_hotel(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN (SELECT hotel_id FROM public.user_active_hotel WHERE user_id = auth.uid()) IS NOT NULL
      THEN _hotel_id = (SELECT hotel_id FROM public.user_active_hotel WHERE user_id = auth.uid())
    WHEN private.is_regional_admin(auth.uid()) THEN TRUE
    ELSE FALSE
  END
$function$;

-- 5. handle_new_user: allow already-approved workflow to still work; when a signup
-- comes in without any hotel_id claim, do nothing about memberships (admin will assign).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  begin
    target_hotel_id := nullif(new.raw_user_meta_data->>'hotel_id', '')::uuid;
  exception when others then
    target_hotel_id := null;
  end;

  if target_hotel_id is not null then
    insert into public.hotel_members (user_id, hotel_id)
    values (new.id, target_hotel_id)
    on conflict (user_id, hotel_id) do nothing;
  end if;

  return new;
end;
$function$;