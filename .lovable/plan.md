## Multi-Item Counter + Rooms 1–50

A clean, minimal single-page app for tracking item counts and marking off rooms 1–50. Everything saves to a Lovable Cloud account so the same list is available on any device.

### Pages / Routes
- `/login` — email/password + Google sign-in
- `/` (auth-gated) — the counter + room grid

### Home page UI
1. **Header** — app title, signed-in email, sign out button.
2. **Add item** — text input + "Add" button. Enter also submits.
3. **Item list** — each row shows:
   - Item name
   - `−` button, count display, `+` button
   - Small delete (×) button
   - Counts cannot go below 0
4. **Rooms 1–50** — section below the list with 50 small square buttons in a responsive grid. Click toggles done/undone. Done rooms are visually dimmed with a strikethrough. A small "Reset all" link clears done state.

Clean & minimal aesthetic: lots of whitespace, neutral grays, single subtle accent, semantic tokens in `src/styles.css`.

### Data model (Lovable Cloud / Postgres)
- `items` — `id uuid pk`, `user_id uuid references auth.users`, `name text`, `count int default 0`, `created_at timestamptz`
- `rooms` — `id uuid pk`, `user_id uuid`, `room_number int (1–50)`, `done bool`, unique `(user_id, room_number)`
- RLS: each row visible/mutable only by its `user_id` (`auth.uid() = user_id`).

No profiles table needed (no display name/avatar requirements).

### Technical approach
- Enable Lovable Cloud; configure email/password + Google auth.
- `_authenticated` layout route gates `/`.
- `src/integrations/supabase/client` used directly from components with TanStack Query for reads/mutations (no server functions needed — RLS handles security).
- Optimistic updates on +/−/toggle for snappy feel.
- Add `attachSupabaseAuth` already shipped; no protected server fns required this round.

### Files to add
- `src/routes/_authenticated.tsx` (auth gate + outlet)
- `src/routes/_authenticated/index.tsx` (counter + rooms page)
- `src/routes/login.tsx`
- `src/routes/index.tsx` → redirect to `/_authenticated` home
- `src/components/ItemRow.tsx`, `src/components/RoomGrid.tsx`
- Migration creating `items` and `rooms` tables with RLS policies

### Out of scope
- Sharing lists between users
- Categories/tags on items
- History/undo beyond what optimistic mutations provide
