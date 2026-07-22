## Goal
When housekeeping presses **Reset all** in the morning, preserve any reception-set flags that were added after **4pm the previous day** — specifically `guest_vacated`, `early_check_in`, and the per-room `needs_maintenance` flag. Maintenance log entries themselves already survive reset (the `maintenance_requests` table isn't touched), so this is only about the flags shown on room tiles.

## How "after 4pm" is decided
On each reset, compute a cutoff:
- If current time is **before 4pm** → cutoff = yesterday 16:00 (local).
- If current time is **after 4pm** → cutoff = today 16:00 (local).

Any flag set at ≥ cutoff is preserved; anything older is cleared. This means:
- A morning reset keeps everything reception logged since 4pm the day before.
- A reset in the evening (after 4pm) would only preserve flags from *today's* 4pm onward — matches the user's "for the following reset" framing.

## Database changes (single migration)
Add nullable timestamps to `public.rooms`:
- `guest_vacated_at timestamptz`
- `early_check_in_at timestamptz`
- `needs_maintenance_at timestamptz`

Set them when the corresponding flag is turned **on** (cleared when turned off). Backfill existing `true` rows with `now()` so they aren't wiped by the very next reset.

## App changes (`src/routes/app.tsx`)
1. Wherever reception toggles these three flags (checkout mark, early check-in, maintenance flag), also write the matching `_at` timestamp — `now()` when set true, `null` when set false. Optimistic cache updates mirror this.
2. Rewrite `performResetAll` to be **selective** instead of a blanket wipe:
   - Compute the 4pm cutoff in JS.
   - Split rooms into two groups:
     - **Preserve group** — any room where at least one `_at` timestamp is ≥ cutoff. For these, keep the "fresh" flags (and their `_at`) intact, clear only the housekeeping-side fields (`done`, `done_reception`, `housekeeping_note`, `reception_status_id`, `reception_bed_id`) and stale `_at` flags that are older than the cutoff.
     - **Full-reset group** — everything else clears exactly as today.
   - `room_item_counts` and pinned `room_messages` behavior is unchanged (counts wiped, messages dismissed-but-kept).
3. Update the confirmation copy on the Reset-all button to: *"Reset all rooms? Reception flags added after 4pm will stay."*
4. The 7-tap easter-egg reset uses the same `performResetAll`, so it inherits this behavior automatically.

## Out of scope
- No changes to `resetReceptionAll` (that button is explicitly a reception-side wipe).
- No changes to the maintenance log, lost property, chat messages, or stayover photos.
- No new UI beyond the confirmation text tweak.