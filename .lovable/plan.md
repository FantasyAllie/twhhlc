## Goal

Add a new **Room Status** export (alongside Totals and Rejects) that produces a two-column sheet matching the uploaded PDF: Room | Status | Set As. The Status column reflects each room's Reception → Room Status selection; the Set As column reflects Reception → Bed Set As. Selections are persisted to the database so they survive refresh and are shared across devices/users.

## Changes

### 1. Persist per-room Reception selections (database)

Add two nullable columns to `public.rooms`:
- `reception_status_id uuid` — references the selected `reception_items` row (kind = 'status')
- `reception_bed_id uuid` — references the selected `reception_items` row (kind = 'bed')

Both nullable, no FK cascade required (resolve label by lookup; if a reception item is deleted, the room's value just becomes orphaned and shows as blank — acceptable for an MVP).

### 2. Wire UI state to the database

In `src/routes/app.tsx`:
- Replace the local `roomOccupancy` and `roomBedType` `useState` with values derived from `rooms` (`reception_status_id`, `reception_bed_id`), with optimistic updates via TanStack Query like other `rooms` mutations.
- When user selects/deselects a status or bed in the per-room Reception dropdown, `UPDATE rooms` for that row and invalidate.
- Keep the existing "default_status falls back when no per-room status set" behavior: effective status = `reception_status_id ?? default_status`.

### 3. New "Room Status" export

Extend the existing `export_snapshots` flow:
- Add `kind = 'room_status'` to the allowed kinds (no schema change — `kind` is text).
- New `SnapshotRow` shape stored in the existing `totals` jsonb column: `{ room: number, status: string, bed: string }[]`. Existing Totals/Rejects snapshots are unaffected.
- Add a `computeRoomStatus()` function: iterate `rooms` sorted by `room_number`, resolve labels from `receptionItems`, output rows (include rooms with blank status/bed).
- Add `openRoomStatusExport()` / `proceedExport('room_status')` mirroring the same-day overwrite confirmation used by Totals/Rejects.
- Add menu entry "Room Status" in the export menu, alongside Totals and Rejects.

### 4. Room Status snapshot view

New dialog (or extend existing snapshot viewer) that renders rows in a two-column layout matching the PDF:
- Header: "Room Status Sheet" + the snapshot date
- Two side-by-side tables (left half = first half of rooms, right half = second half), each with columns: Room | Status | Set As
- Print-friendly styling so the user can use browser print → save as PDF.

### 5. History list

Room Status snapshots appear in the existing snapshots list filtered by `kind = 'room_status'`, with the same daily pruning rules (keep last 6 per day).

## Technical notes

- Migration adds the two columns and an UPDATE policy is already covered by the existing `rooms` policy scoped to `auth.uid()`.
- Type updates in `src/integrations/supabase/types.ts` happen automatically after the migration runs.
- The `Room` TS type and all places that build a `Room` (default rows, optimistic inserts) need `reception_status_id: null, reception_bed_id: null` added.
- No new dependencies; reuse existing `Dialog`, `Table`, and snapshot infrastructure.
