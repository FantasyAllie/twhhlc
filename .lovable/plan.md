## Goal

Split today's flat role list into two concepts:

- **Position** — one per user: `Admin`, `Manager`, or `User` (plus `pending` internally). Determines capability tier.
- **Sub-role(s)** — zero or more per user: `Reception`, `Housekeeper`. Determines which day-to-day views/screens the person uses.

Capabilities per position (unchanged from today, just renamed/consolidated):

- **Admin** — everything, including the Users window (approve/create/edit/delete/reset password/disable).
- **Manager** — same as Admin *except* cannot open the Users window, cannot approve pending signups, and cannot edit/create/delete users.
- **User** — no admin tooling. What they can actually do is decided by their sub-role(s).

Sub-role capabilities (kept identical to today):

- **Reception** — the reception view (Clean/Arrival/DND/OUT flow, checkout, messages, bulk status, reception help, etc.).
- **Housekeeper** — the housekeeping view (linen counts, statuses, bed selection, mark-as-done, notes/maintenance).

Users can hold both sub-roles (Allie). Position and sub-roles are independent — e.g. a Manager can also hold the Housekeeper sub-role so they can jump into the housekeeping view. "View as" switches between the sub-roles the account actually holds (plus Admin/Manager tiers for Admins/Managers).

## Target assignments

| User | Position | Sub-role(s) |
| --- | --- | --- |
| Allie (fantasyallie@icloud.com) | Admin | Reception + Housekeeper |
| Beckii | Manager | Housekeeper |
| Marcia Drake | Manager | Housekeeper |
| AJ | Manager | Housekeeper |
| reception@themickleton.co.uk | User | Reception |
| Shannon | User | Housekeeper |

## Data model

Reuse `public.user_roles` — one row per (user, role). Each user gets exactly one *position* row (`admin`/`manager`/`user`/`pending`) plus zero or more *sub-role* rows (`reception`/`housekeeper`).

- Add `housekeeper` to the `public.app_role` enum. Keep `user` as the base position value (previously overloaded as "housekeeper"; we stop treating it as a view).
- Migration also seeds the assignments in the table above, replacing existing rows for those six accounts.
- `handle_new_user` trigger keeps assigning `pending` on signup (position only, no sub-roles) — Admins pick position + sub-roles when approving.
- `is_approved()` continues to treat any non-`pending` position as approved.

Sub-role notification/RLS policies stay as they are (they gate on `is_approved`, not on the specific role).

## Server functions (`src/lib/auth.functions.ts`)

- New types: `Position = "admin" | "manager" | "user"`, `SubRole = "reception" | "housekeeper"`, `AppUserRow` gains `position` + `subRoles: SubRole[]` (drop the single `role`).
- `listUsers` returns position + sub-role array per user.
- Replace `updateUserRole` with `updateUserAssignment({ id, position, subRoles })` that rewrites all role rows for a user in one transaction (still guards the "last admin" rule against the position field).
- `createUser` takes `{ position, subRoles }`.
- Approving a pending user is just `updateUserAssignment` with a real position (+ optional sub-roles).
- All admin-only server fns keep `assertAdmin` — Managers stay blocked from user-management endpoints.

## Client session (`src/lib/auth-client.ts`, `SessionUser`)

`SessionUser` becomes `{ id, username, email, position, subRoles }`. Fetch all rows from `user_roles` for the signed-in user and split into position + sub-roles. Persist the new shape in `localStorage` under the existing key (old cached shape is discarded on next `refreshSession`).

## App-wide permission remap (`src/routes/app.tsx` and friends)

Introduce derived flags from `SessionUser`:

- `isAdminPos` = position `admin`
- `isManagerPos` = position `manager`
- `canUseAdminTools` = `isAdminPos || isManagerPos` (drives everything today's `isAdmin` guards)
- `canManageUsers` = `isAdminPos` only (Users menu entry, `/users` route, Users dialog, approve buttons)
- `hasReceptionRole`, `hasHousekeeperRole` from sub-roles
- `effectiveView` = current "view as" selection, defaulting to:
  - Admin/Manager position without a sub-role → admin/manager dashboard view (same as today's default)
  - Otherwise the account's single sub-role, or Housekeeper if it holds both (Allie's default; she can switch)

Then update every existing check:

- `isReception` → `effectiveView === "reception"`
- `isHousekeeper` → `effectiveView === "housekeeper"`
- `isAdmin` (used for admin UI chrome like Manage/Export/Users) → `canUseAdminTools` when `effectiveView` is the admin/manager tier; otherwise falls through to the sub-role view being rendered.
- Notification preference gating: reuse `hasReceptionRole`/`hasHousekeeperRole` (and position) so an Admin sees all toggles, a User+Reception hides the "room marked done" toggle, etc. — matches today's behavior per user.
- `/users` route + `UsersDialog` entry point and menu item: gated on `canManageUsers`.

"View as" selector (`AccountDialog`):

- Options = `Admin` (if position admin) + `Manager` (if position admin or manager) + one entry per sub-role the account holds.
- Users with a single sub-role and no admin tier see no selector.
- Persist selection in the existing `tw_view_as_role` key; extend the accepted values to include `housekeeper`.

## Users management UI (`src/components/users-dialog.tsx` + `/users` route)

- Rename the header/label "Role" → "Position" throughout.
- Position control: dropdown with Admin / Manager / User.
- Sub-role control: two checkboxes (Reception, Housekeeper), independent of position.
- Add-user form, Edit dialog, and Pending-approval list all use position + sub-roles. Approving a pending signup requires choosing a position; sub-roles are optional (but if position is `User`, warn if no sub-roles are selected so the account isn't left without a view).
- Approved list shows position badge + sub-role chips (e.g. "Manager · Housekeeper").
- Managers cannot open this dialog or route at all (already the case for `/users`; extend to hide the menu entry and to make the dialog trigger no-op if reached). Server-side `assertAdmin` remains the source of truth.

## Backend migration steps

1. `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'housekeeper';` (in its own migration so subsequent DML can use it).
2. Second migration seeds assignments: for each of the six named accounts, delete existing `user_roles` rows and insert the new (position + sub-role) rows listed above.
3. Verify `handle_new_user` still fires for future signups (no change needed).

## Out of scope / preserved

- Room tile logic, notifications, maintenance log, reset flow, export menus — unchanged.
- Notification preference storage — unchanged; only the visibility rules are remapped from the old flat role to the new position/sub-role flags.
- No new capabilities are added or removed; this is purely a rename + split of roles.
