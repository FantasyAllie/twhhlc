# Undo for housekeeping changes

Add an Undo button for housekeeping so the last change can be rolled back — most importantly a "Reset all" pressed by mistake, which currently wipes room statuses, linen counts and the progress bar with no way back.

## What the user gets

- A small **Undo** button next to "Reset all" on the home screen, visible to housekeeping only. It is greyed out when there is nothing to undo, and its tooltip/label says what will be undone (e.g. "Undo Reset all", "Undo Room 27 marked done").
- After a Reset all, a confirmation message appears with an **Undo** action, so it can be rolled back straight from the message.
- Undo restores every room's status, bed, flags, done marks, notes, and all linen/reject/delivery counts exactly as they were the moment before the action — the progress bar returns to its earlier value.
- Up to 10 recent actions can be undone, most recent first. History is per session (it clears if the page is reloaded) and only covers actions made on this device.
- Undo itself can be undone (undoing pushes a "Redo last undo" entry).

## Which actions get undo

- Reset all (housekeeping and reception's version of it)
- Mark room done / not done, room status and bed selection, guest flags (checked out, early check-in, late checkout, stayover out, dog), housekeeping notes
- Linen count changes for a room, and "Clear room counts"

## Technical approach

New `src/lib/undo.ts` exporting `useUndoStack()`:

- Holds a bounded stack (10) of entries `{ id, label, at, rooms: Room[], counts: RoomCount[], rejects?, deliveries?, scope: 'rooms' | 'all' }`.
- `capture(label, opts)` reads current `["rooms"]`, `["room_counts"]` (and, for a reset, `["reject_counts"]`, `["delivery_counts"]`) from the query cache and pushes a deep-cloned snapshot.
- `undo()` pops the newest entry, captures the present state first (so undo is reversible), then restores:
  - `rooms`: upsert the snapshot rows via `supabase.from("rooms").upsert(rows, { onConflict: "user_id,hotel_id,room_number" })` writing back the same mutable columns the reset touches.
  - `room_item_counts`: delete all, then insert the snapshot rows (same for `reject_counts` / `delivery_counts` when in scope).
  - clears `pendingCounts` and sets the query cache optimistically, then invalidates `rooms`, `room_counts`, `reject_counts`, `delivery_counts`.
- Failures surface via `toast.error` and leave the entry on the stack.

In `src/routes/app.tsx`:

- Instantiate the stack; call `capture()` at the top of `performResetAll`, `toggleHousekeepingDone`, `toggleReceptionDone`, status/bed/flag setters, count setters and `clearRoomCounts`.
- Coalesce rapid repeats: a capture with the same label within 3 seconds replaces nothing (keeps the older snapshot) so a burst of + taps undoes back to before the burst.
- Render the Undo button in the housekeeping filter/reset row; show the success toast with an Undo action after `performResetAll`.

Note: undo replays writes through the normal shared backend, so other staff see the rollback too. It cannot restore data another device changed after the action — the newest state simply wins.
