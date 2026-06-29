# Migrate to Supabase Auth + Approval Queue

## Goal
Replace the custom `app_users` JWT login with Supabase Auth (email/password +
Google), keep the existing shared-workspace data intact, and gate every new
signup behind an admin-approval queue.

## Key fact that makes this safe
All existing rows in `rooms`, `room_item_counts`, `template_items`,
`room_messages`, etc. already use the shared sentinel
`user_id = 00000000-0000-0000-0000-000000000000`. There is **no per-user
data to migrate** — everyone who is approved sees the same workspace as
today.

## Database (one migration)
1. `app_role` enum: `admin`, `user`, `reception`, `pending`.
2. `profiles` table (`id` = `auth.users.id`, `email`, `display_name`).
3. `user_roles` table (`user_id`, `role`) + `has_role()` SECURITY DEFINER fn.
4. Trigger on `auth.users` insert →
   - insert profile,
   - insert role `admin` if email = `fantasyallie@icloud.com` (case-insensitive),
     otherwise role `pending`.
5. Rewrite every existing `USING (true)` policy on `rooms`, `room_messages`,
   `room_item_counts`, `reject_counts`, `template_items`,
   `template_item_rooms`, `room_extra_items`, `room_features`,
   `room_feature_rooms`, `room_types`, `reception_items`, `export_snapshots`
   to:
   `TO authenticated USING (NOT has_role(auth.uid(),'pending'))`
   with the same `WITH CHECK` for writes. (Drops anon access — fixes the 13
   open security findings.)
6. Revoke the `anon` grants on those tables; keep `authenticated` grants.
7. Leave `app_users` table in place for now (read-only fallback, no code
   path touches it after the cutover). Can be dropped later.

## Code
- **Auth client**: use `supabase.auth` directly in the browser + the
  generated `lovable.auth.signInWithOAuth("google", …)` for Google.
- **`/login`** → rebuild as `/auth` (sign-in + sign-up tabs, Google button,
  forgot password link). Show "Account pending approval" message after
  signup.
- **`/_authenticated` layout** (managed) already exists in the template —
  add it, move `/app` and `/users` underneath.
- **`use-session` hook** replaces the current localStorage token: reads
  `supabase.auth.getUser()` + `onAuthStateChange`, plus the user's role from
  `user_roles`. Exposes `{ user, role, isAdmin, isPending }`.
- **App guard** (`/app`): if `isPending`, render "Waiting for admin
  approval" screen instead of the app.
- **Server functions** (`src/lib/auth.functions.ts`): rewrite to use
  `requireSupabaseAuth` middleware. New surface:
  - `listUsers` (admin) → joins profiles + roles, returns pending + approved
  - `approveUser({id, role})` (admin) → sets role on `user_roles`
  - `updateUserRole`, `deleteUser` (admin) — via Auth Admin API
  - Drop `login`, `me`, `updateMyPassword`, `updateMyUsername` (Supabase
    handles these natively).
- **`/users` page + dialog**: add a "Pending approvals" section at the top;
  approve = pick role (user/reception/admin); deny = delete the auth user.
- **Reset password page** `/reset-password`.
- Enable Google provider via `supabase--configure_social_auth`.

## Cutover impact
- The 6 existing `app_users` accounts (Allie, Marcia, Beckii, AJ, Reception,
  Shannon) **will stop being able to sign in** — they must each sign up
  fresh with email/password (or Google). Allie's `fantasyallie@icloud.com`
  signup auto-promotes to admin so she can approve the others.
- All their **data is preserved** (shared workspace sentinel).

## Out of scope
- Email domain restriction (any email allowed; admin approval is the gate).
- Per-user data isolation (intentionally a shared workspace).
- Dropping the `app_users` table (left for a future cleanup pass).