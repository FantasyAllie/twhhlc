
# Multi-Hotel Workspaces

The cleanest approach is **row-level multi-tenancy**: one database, every tenant-scoped table gains a `hotel_id` column, and RLS enforces that users only see rows for their hotel. No separate databases, no duplicated code. This scales to dozens of hotels with negligible overhead — Postgres just adds `WHERE hotel_id = ...` to every query via policy.

## Concepts

- **Hotel (workspace)**: a self-contained tenant. Has its own rooms, room types, templates, messages, lost property, maintenance, photos, features, etc.
- **Membership**: a user belongs to exactly one hotel (simple model) — or to many (if you want staff who float between properties). Recommend starting with one-hotel-per-user; easy to widen later.
- **Regional admin**: a new global role that bypasses the hotel filter and can see/manage all hotels and all users.
- **Existing roles** (admin, manager, user + sub-roles) stay exactly as they are — but now they're scoped *within* a hotel. A "hotel admin" only administers their own property.

## Data model changes

New tables:
- `hotels` — id, name, slug, timezone, created_at
- `hotel_members` — user_id, hotel_id, unique(user_id) if single-hotel; drop unique if multi-hotel later

New role value: extend `app_role` enum with `regional_admin` (global, cross-hotel).

Add `hotel_id uuid not null references hotels(id)` to every tenant table:
rooms, room_types, room_features, room_feature_rooms, template_items, template_item_rooms, room_extra_items, room_item_counts, reject_counts, room_messages, lost_property, maintenance_requests, reception_items, fnb_linen_counts, stayover_photos, export_snapshots, notification_preferences (optional), push_subscriptions (optional per-hotel routing).

Backfill: assign every existing row to a single default hotel ("The Winston" or whatever you call the current property). One-time migration — zero data loss.

## RLS pattern

Add a security-definer helper:

```sql
create function public.current_hotel_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select hotel_id from public.hotel_members where user_id = auth.uid()
$$;

create function public.is_regional_admin(_uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles
                where user_id = _uid and role = 'regional_admin')
$$;
```

Every existing policy on tenant tables gets AND'd with:
```
(hotel_id = public.current_hotel_id() OR public.is_regional_admin(auth.uid()))
```

Regional admins see everything. Everyone else sees only their hotel. No app-code filtering needed — the DB enforces it.

## User visibility

The `listUsers` / `listPendingUsers` server functions become hotel-scoped: they join `hotel_members` and filter to the caller's hotel unless the caller is a regional admin. Hotel admins/managers see and approve only their own hotel's staff.

`createUser` requires a `hotelId` — regional admins can create users in any hotel, hotel admins can only create in their own. The `handle_new_user` trigger inserts into `hotel_members` from a `raw_user_meta_data.hotel_id` claim set at signup / admin-create time.

## Onboarding new hotels

Regional admin flow:
1. Create hotel (name, slug, timezone).
2. Invite the first hotel admin with `hotelId` set.
3. That admin approves their own staff and configures rooms/templates like today.

Each hotel gets its own room list, templates, messages, photos — fully isolated. Users signing in see only their property.

## UI changes (small)

- Login unchanged.
- Header shows current hotel name for context.
- Regional admin gets a hotel switcher (dropdown) and cross-hotel views in the users dialog.
- New "Hotels" settings page (regional-admin only) to create/rename hotels.
- Hotel admins see their existing settings unchanged.

## Performance

Adding `hotel_id` + an index on it costs nothing meaningful — every query already filters by user or room. Postgres RLS is a query rewrite, not a runtime tax. Systems with hundreds of tenants run this pattern comfortably; you'll have single digits.

## Migration order (one-way, safe)

1. Create `hotels`, `hotel_members`, `regional_admin` enum value, helper functions.
2. Seed one hotel and assign all existing users to it.
3. Add nullable `hotel_id` to every tenant table, backfill from that seed hotel, then set NOT NULL.
4. Rewrite policies to include the hotel filter.
5. Update `handle_new_user`, `listUsers`, `createUser`, `approvePendingUser`, `listPendingUsers` to be hotel-aware.
6. Add hotel switcher + Hotels admin page.
7. (Later) if needed, drop the unique constraint on `hotel_members.user_id` to support multi-hotel staff.

## Open questions before I plan the implementation

1. **Single-hotel vs multi-hotel users**: start with one hotel per user (simpler, matches your description), or allow staff to belong to multiple from day one?
2. **What is the current hotel called?** — I need a name/slug to backfill existing data into.
3. **Regional admin scope**: full cross-hotel edit access, or view-only across hotels + edit only in a "current" hotel they've switched into?
4. **Push notifications**: keep them per-user (current), or scope subscriptions to hotel so a user changing hotels stops getting the old hotel's alerts?

Answer those and I'll produce the concrete migration + code plan.
