## Per-room items with accordion

Reshape the app so the rooms grid is the main UI. Clicking a room number expands an inline panel showing items to count. Only one room is open at a time. Clicking the same room again collapses it.

### UI changes (`src/routes/app.tsx`)

- Remove the standalone Items section.
- Keep the 50-room grid as the primary content. Replace the toggle-done click behavior:
  - Click a room number → opens that room's panel (closes any other), and marks the room as done.
  - Click an already-open room → collapses it (stays done).
  - Long-press or a small undo control inside the panel can reset done. Simpler: a "Mark not done" link inside the open panel.
- Below the grid (or inline after the clicked row), render the expanded room panel:
  - "Template items" — the shared list (Towels, Soap, etc.). Each row: name, − / count / + buttons. Count is per-room.
  - "Add item to this room" input + button → adds a room-specific extra.
  - Room-specific extras render in the same panel with a × delete.
  - Footer link: "Mark not done" + "Reset counts for this room".
- Above the grid, a small "Manage template" disclosure to add/remove items from the shared template (so the user can curate the master list once).
- Print view: print every room with its items and counts (one room per block), template-items header dimmed for empty rooms; hide controls.

### Data model

Three tables (replacing current `items`):

- `template_items` — shared per-user master list
  - `id`, `user_id`, `name`, `created_at`
- `room_extra_items` — extras attached to a specific room
  - `id`, `user_id`, `room_number` (1–50), `name`, `created_at`
- `room_item_counts` — per-(room, item) count, where the item is either a template item or a room extra
  - `id`, `user_id`, `room_number`, `item_kind` ('template' | 'extra'), `item_id` (uuid of template_items or room_extra_items), `count` (int ≥ 0), `updated_at`
  - unique `(user_id, room_number, item_kind, item_id)`

Keep existing `rooms` table for the `done` flag.

All tables: RLS `auth.uid() = user_id` for select/insert/update/delete.

Migration also drops the old `items` table (no longer used).

### Behavior details

- Opening a room: sets `done = true` via upsert into `rooms`, sets `openRoom` state to that number.
- Opening room N closes any previously open room (accordion).
- Counts are upserts into `room_item_counts` keyed by (room_number, item_kind, item_id). `−` deletes the row when reaching 0 (or sets to 0; we'll set to 0 for simplicity).
- Adding a template item: shows up in every room's panel with count 0 until incremented.
- Deleting a template item: cascades by deleting its `room_item_counts` rows (handled by `ON DELETE CASCADE` foreign keys).
- "Reset all" on rooms: sets all `rooms.done = false` and clears `room_item_counts` (with confirm).

### Queries (TanStack Query keys)

- `["template_items", userId]`
- `["room_extras", userId]` (all extras, grouped client-side by room_number)
- `["room_counts", userId]` (all counts, grouped client-side by room_number)
- `["rooms", userId]` (existing)

All optimistic updates as today.

### Files

- Edit `src/routes/app.tsx` — restructure UI.
- One migration creating `template_items`, `room_extra_items`, `room_item_counts` with FKs + RLS, and dropping `items`.

### Out of scope

- Reordering items.
- Notes per item.
- Per-item history.
