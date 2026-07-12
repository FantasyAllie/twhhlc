-- Expand the cross-hotel helper so that both 'admin' and 'regional_admin'
-- (now displayed as "Regional Manager") pass the check. Admins are the
-- highest clearance and must see everything.
create or replace function private.is_regional_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = private, public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _uid
      and role::text in ('admin', 'regional_admin')
  )
$$;

revoke all on function private.is_regional_admin(uuid) from public, anon;
grant execute on function private.is_regional_admin(uuid) to authenticated, service_role;