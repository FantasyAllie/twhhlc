## Messaging between sub-roles

Adds a Messages feature to the burger menu with shared role-pair threads, plus two-way sync between HK↔Reception room-tagged messages and each room's Notes.

### 1. Data model (one migration)

Extend `room_messages` (currently per-user notes) into a shared messaging table used by both the Messages sheet and the room Notes surface.

New columns on `room_messages`:
- `thread` text NOT NULL — one of `hk_reception`, `hk_fnb`, `reception_fnb`.
- `author_id` uuid — the sender (was implicitly `user_id`).
- `room_number` int NULL — nullable now (general messages have no room).
- `done_at` timestamptz NULL — set when someone marks it done.
- `deleted_at` timestamptz NULL — soft delete so both surfaces hide it in sync.

Migration steps:
- Add columns; backfill `thread='hk_reception'`, `author_id = user_id` for existing rows, keep their `room_number`.
- Drop `user_id` / `dismissed` from client reads (keep column for now to avoid breaking existing code path; new code ignores them). `dismissed=true` maps to `done_at=now()` in a one-time backfill.
- Update RLS: any authenticated user with position admin/manager OR a sub-role in that thread can SELECT/INSERT/UPDATE (soft-delete/done). Grants: `SELECT, INSERT, UPDATE` to `authenticated`, `ALL` to `service_role`.
- Enable Realtime on `room_messages` (already may be — verified in migration).
- Auto-hide rule: rows where `done_at < now() - interval '24 hours'` are filtered out of default queries (kept in DB for history).

Thread membership rule (server-enforced in a helper + RLS):
- `hk_reception`: admin, manager, housekeeper, reception.
- `hk_fnb`: admin, manager, housekeeper, fnb.
- `reception_fnb`: admin, manager, reception, fnb.

### 2. Server functions (`src/lib/messages.functions.ts`)

All `.middleware([requireSupabaseAuth])`, gated by real sub-role/position:
- `listMessages({ thread })` → rows ordered by `created_at`, excluding `deleted_at` and stale-done (>24h).
- `listRoomMessages({ roomNumber })` → messages for one room across all threads, same filters.
- `sendMessage({ thread, body, roomNumber? })` → inserts with `author_id = userId`, `created_by_username` from profile.
- `markMessageDone({ id })` / `undoMessageDone({ id })`
- `deleteMessage({ id })` → sets `deleted_at`. Author or admin/manager only.

### 3. Messages sheet (burger menu → "Messages")

New component `src/components/messages-sheet.tsx`, opened from both desktop DropdownMenu and mobile Sheet in `src/routes/app.tsx`.

Visibility: shown whenever the user has ≥1 thread available (admin/manager always see all three; a user sees the threads their sub-roles touch).

Layout:
- Header pill picker of available threads (Housekeeping ↔ Reception, Housekeeping ↔ F&B, Reception ↔ F&B). If only one thread is available, no picker.
- Scrollable feed grouped by day. Each message: author, time, body, optional Room chip (e.g. `Room 214`) that scrolls the underlying board to the room. Own messages right-aligned.
- Done messages render dimmed with a "Done" tag; auto-hide after 24h (server-side filter).
- Composer at bottom: text input + optional Room selector (only enabled for `hk_reception` — the only thread with room routing). Send button.
- Realtime: subscribe once inside the sheet's `useEffect`, tear down on close, invalidate query on `INSERT`/`UPDATE`.
- Mobile: slide-in from bottom Sheet, same physics as the Help sheet.

### 4. Room Notes surface (room view)

Inside the existing room detail dialog, add a "Notes" section that lists `listRoomMessages(roomNumber)` for the `hk_reception` thread. Each entry has:
- Body + author + time.
- Action row: **Mark done**, **Delete**, **Reply**.
  - Mark done sets `done_at`; row fades out here after 24h, stays in Messages history until it also ages out.
  - Delete soft-deletes; disappears from both surfaces immediately.
  - Reply closes the room dialog and opens the Messages sheet with the `hk_reception` thread, room pre-filled, and focus in the composer.

A small badge on the room tile (housekeeper + reception views) shows count of un-done, non-deleted room messages. Because messages are shared, no per-user read state is needed.

### 5. Wiring in `src/routes/app.tsx`

- Add "Messages" item in both desktop DropdownMenu and mobile Sheet, gated by the same "≥1 thread" rule.
- Add Notes section to the room dialog (housekeeper + reception views; F&B view unaffected).
- Add message-count badge to room tile.
- No changes to existing role-picker, filters, or reset logic.

### 6. Files touched

- `src/routes/app.tsx` — menu entry, room dialog Notes section, room tile badge.
- `src/components/messages-sheet.tsx` — new.
- `src/lib/messages.functions.ts` — new.
- One migration: schema + RLS + grants on `room_messages`.

### Technical notes

- The single "hk_reception room-tagged message" row is the source of truth; both the Messages sheet and the room's Notes render the same row. Mark done / delete flip flags on that row and both surfaces update via Realtime + query invalidation.
- Auto-hide is a filter, not a delete, so history stays queryable if you later want an "Archive" view.
- The `hk_fnb` and `reception_fnb` threads exist but don't get room routing — those roles don't operate per-room in the app today.
- Existing `room_messages` reads elsewhere (if any) continue to work because we only add columns; the old `user_id`/`dismissed` columns stay.

### Open follow-ups (not in this plan unless you want them)

- Push notifications on new messages (VAPID is already wired) — say the word and I'll add it.
- Unread indicator on the burger menu — needs a per-user "last seen" table; happy to add if you want it.
