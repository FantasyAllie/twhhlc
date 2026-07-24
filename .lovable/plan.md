## Goal

Restrict the printable "Linen totals" export to configured delivery days, and on those days produce a **totalled** linen list that rolls up the daily linen counts from the days since the previous delivery day.

Daily linen totals stay available every day — the new delivery roll-up appears as an additional option only on delivery days.

## How it will work day-to-day

1. Admin / Regional Manager / Manager-with-Housekeeping opens **Settings → Linen delivery days** and ticks the weekdays that goods are delivered (e.g. Mon + Fri).
2. Every night an auto-snapshot captures that day's linen totals per hotel, so no day gets missed even if nobody hits export.
3. On a delivery day the Export sheet shows an extra button: **"Delivery linen totals"**. Tapping it sums every daily snapshot from the day after the previous delivery day up to and including today, and opens the printable sheet.
   - Example with Mon + Fri delivery:
     - **Friday's** delivery total = Mon + Tue + Wed + Thu + Fri
     - **Monday's** delivery total = Fri + Sat + Sun + Mon
4. On non-delivery days the button is hidden; the normal daily "Linen totals" is unchanged.

## Details for the technical bits

### Data

- New column `hotels.linen_delivery_days int[]` (0=Sun … 6=Sat). Empty/null = no delivery-day restriction, feature dormant.
- Reuse existing `export_snapshots` (kind = `totals`) as the per-day source of truth. Roll-up sums by item name across snapshots whose `created_at::date` falls in the range.
- Range end: today (hotel local time). Range start: day after the most recent earlier delivery weekday in `linen_delivery_days`, walking back up to 13 days. If none found, fall back to the last 7 days.

### Auto-snapshot at end of day

- New TanStack server route `src/routes/api/public/hooks/linen-daily-snapshot.ts`, auth'd via `apikey` header, service-role client.
- For each hotel: compute today's linen totals from `room_item_counts` + templates/extras and upsert one `export_snapshots` row per hotel per day with `kind='totals'`. Skip hotels that already have a manual snapshot for today so we don't stomp on it.
- `pg_cron` runs it daily at 23:55 UTC (adjustable). Retention: keep 21 days of `totals` snapshots (widen the current `pruneSnapshots` window from 6 to 21 for `totals` only).

### UI

- **Settings sheet** (both mobile and desktop): new "Linen delivery days" section — 7 weekday toggles, visible only to eligible roles/department. Save writes to `hotels.linen_delivery_days` for the current hotel.
- **Export sheet** (`src/routes/app.tsx` around lines 3331–3370): add a **"Delivery linen totals"** button that renders only when `today ∈ hotel.linen_delivery_days`. Uses the existing print layout, header changes to "`{hotel} Linen — Delivery ({rangeStart}–{today})`".
- Roll-up computation lives client-side alongside `computeTotals`: fetch snapshots in range for this hotel, merge rows by trimmed name, sum counts, sort A→Z, compute grand total. Print via the existing `printTotals` helper with a new `kind`-agnostic header string (no schema change to snapshot kinds).

### Permissions

- Setting is editable when user is Admin, Regional Manager, or (Manager AND has Housekeeping in `departments`). Read-only visible to everyone in the same hotel so staff know the schedule.
- RLS on `hotels` already scopes by membership; the new column inherits it. Add a policy note that only the roles above may UPDATE `linen_delivery_days` (enforced via a security-definer function used in the UPDATE policy).

### Edge cases handled

- Missing day (no snapshot exists): treated as 0 contribution, roll-up still succeeds.
- Multiple snapshots per day: use the most recent one for that day.
- Delivery days list empty: hide the delivery button entirely.
- Hotel switching: everything scopes to `hotel_id` from `useCurrentHotel`.
- Timezone: use the browser's local date for "today" and for bucketing snapshot dates so the day matches what staff see on screen.

## Deliverables

1. Migration: `hotels.linen_delivery_days`, UPDATE policy, and widen `totals` snapshot retention.
2. Server route + `pg_cron` schedule for nightly auto-snapshot.
3. Settings UI for delivery days (mobile + desktop).
4. Export sheet: conditional "Delivery linen totals" button + roll-up compute + print.
5. Read-only display of the schedule next to the button (e.g. "Deliveries: Mon, Fri").

No changes to existing daily "Linen totals" behaviour.