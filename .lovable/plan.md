
# Reworked exports: automatic snapshots + one-tap prints

## Goal

Cut manual exporting to almost zero without ever losing a day of data. A daily backend job takes a snapshot of everything that could be printed later; the export UI turns into simple day-gated print buttons that just print from those snapshots.

## How it works

### 1. Nightly snapshot job (per hotel)

A single scheduled backend job runs once a day (per hotel timezone, end-of-day) and writes one row per hotel per kind into the existing `export_snapshots` table:

- `totals` — housekeeping linen totals for the day (from `room_item_counts` rolled up per item)
- `fnb_totals` — F&B linen totals for the day (from `fnb_linen_counts`)
- `room_status` — room list with status, bed, maintenance flag
- `maintenance` — rooms flagged for maintenance

This means: even if nobody presses anything, every day is captured. When someone prints, we always print from stored snapshots.

Retention on `export_snapshots` gets extended from 7 days to ~60 days per kind so the weekly F&B roll-up and the multi-day linen delivery window always have complete data.

### 2. Room status — auto at 3pm shift end

- The backend job also runs an early snapshot per hotel at 3pm local time for `room_status` (this is the shift end).
- The existing "Mark shift as finished" button on the housekeeping home screen keeps working — pressing it prints the 3pm snapshot (or takes a fresh one if the cron hasn't fired yet).
- If nobody presses the button, the data still exists — anyone can open Exports and print "Today's room status" until midnight, always from the 3pm snapshot.

### 3. Housekeeping linen — delivery days only

- The "Delivery linen totals" button in HK exports is only visible on days listed in the hotel's `linen_delivery_days`.
- One tap: it sums stored `totals` snapshots from the previous delivery day up to yesterday (the logic already exists — it just runs on stored snapshots instead of hoping the user pressed export each day).
- No daily print, no daily prompt — HK only ever sees a print button on the days it matters.

### 4. F&B linen — Mondays only

- The F&B "Weekly linen totals" button is only visible on Mondays.
- One tap: it sums stored `fnb_totals` snapshots from Monday of last week through Sunday.
- On any other day the F&B export screen just shows "Next print: Monday" — nothing to do.

### 5. Manual safety net

If the cron job ever misses a day (backend outage), the client-side print path falls back to computing a fresh snapshot from live data before printing, and writes it into `export_snapshots` for that day. So the worst case is one day looking slightly different — never missing.

## What changes for users

| Role | Before | After |
|---|---|---|
| HK on delivery day | Remember to press export daily, then press "Delivery totals" | Press "Delivery totals" once — nothing else |
| HK on non-delivery day | Delivery button shown but produced partial data | Button hidden — nothing to press |
| Reception / HK end of shift | Press "Mark shift as finished" to snapshot + print | Same button, but data is already snapshotted at 3pm |
| F&B | Remember to press export weekly | Print button only appears Monday, one tap |

## Technical details

### Backend
- New public server route `src/routes/api/public/hooks/daily-snapshot.ts` that:
  - Iterates hotels (loops through `hotels`).
  - For each hotel: computes `totals`, `fnb_totals`, `room_status`, `maintenance` and upserts one row per (hotel, kind) for today into `export_snapshots` (dedup on same-day + kind, matching current overwrite logic).
  - Prunes rows older than 60 days.
- Auth: verified with the shared apikey/anon-key header pattern used by other cron endpoints.
- Two `pg_cron` schedules:
  - `0 15 * * *` — room status shift-end snapshot.
  - `55 23 * * *` — full end-of-day snapshot for all kinds.

### Migration
- No schema change to `export_snapshots` needed (kind, hotel_id, created_at, totals, grand_total already exist).
- Bump snapshot retention in `pruneSnapshots` from 7 days to 60 days (client) and mirror in the cron job.

### Client (`src/routes/app.tsx`)
- Show the HK "Delivery linen totals" button only when `linenDeliveryDays.includes(new Date().getDay())`.
- Show the F&B "Weekly linen totals" button only when today is Monday; add a new `computeWeeklyFnbTotals()` that sums stored `fnb_totals` snapshots for the previous Mon–Sun.
- Replace "Room status" print's live compute with "load today's `room_status` snapshot; if missing, snapshot now, then print".
- Keep existing manual export panel as a fallback but simplify it to just these gated buttons.

## Open question

Where should the daily snapshot fire relative to the hotel's timezone? Two options:
- (a) Fire once at a fixed UTC time (simple, off by a few hours for hotels in other zones).
- (b) Fire per-hotel using `hotels.timezone` (accurate, needs the job to skip hotels whose local time hasn't hit 3pm/23:55 yet — job runs hourly and checks each hotel).

For a single-hotel or same-region multi-hotel setup (a) is fine. If regional expansion is imminent, go with (b).
