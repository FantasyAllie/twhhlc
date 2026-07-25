
This plan groups your 16 items by area so schema/role changes land first (they unblock the UI work), then UI/feature work, then polish. Nothing else is changed.

## 1. Data model & permissions (must land first)

**New "Developer" role (item 15)**
- Add `'developer'` to the `app_role` enum.
- Update `roleRank()` in `src/lib/auth-client.ts` / `auth.functions.ts` so Developer = Admin tier (rank 5+); Admin stays 5, Regional Manager 4, Manager 3.
- Every `has_role(..., 'admin')` RLS check gets an OR `has_role(..., 'developer')` (via a new `private.is_admin_like()` helper) so Developer sees/modifies everything.

**Room messages reply FK bug (item 4)**
- `room_messages_reply_to_id_fkey` currently blocks replies. Change it to `ON DELETE SET NULL` and confirm both messages share the same `hotel_id`. Also ensure the client sends a real UUID (not a client-side temp id) as `reply_to_id`.

**Maintenance photos not visible to Maintenance dept (item 2)**
- Storage policies on `entry-photos` currently require author OR admin. Extend the SELECT policy so users whose `sub_role` includes `'maintenance'` can read objects under `maintenance/**`. Same shape for `lost-property/**` staying author+admin.

**DND photo cleanup when DND removed (item 16)**
- Client-side: whenever we transition a room OUT of `DND` on the same calendar day the photo was taken, call `deleteTodayStayoverPhotosForRoom(roomNumber)` (already exists in `src/lib/stayover-photos.ts`). Wired into the same code path that already handles DND selection.

**Export history retention → 7 days (item 1)**
- `pruneSnapshots` currently keeps 6 days of `totals`; change to keep 7 days for all `kind`s in `export_snapshots`.

## 2. Room status panel & tile (items 3, 16)

- Add third pill **"Not Required"** between DND and Stayover.
- Rules:
  - Tapping "Not Required" → also sets `Stayover` and `Mark as Done`.
  - Untapping "Not Required" → leaves Stayover/Done alone.
  - Adds a distinct visual on the tile (a small "NR" pill in the same slot as the existing DND pill; different color, e.g. muted amber) so it's obvious room service was declined.
- Move the **Staff** status button between **Dirty** and **ROS** in the status grid.
- DND-off-same-day photo purge (item 16) hooks in here.

## 3. Reception home-screen (items 10, 13, 11, 12)

**Reset all for Reception (item 10)**
- Show the Reset-all affordance to Reception only when: local time ≥ 07:00 AND Housekeeping has NOT already reset today.
- "Already reset today" is detected via a new `hotels.last_reset_at timestamptz` column set by `performResetAll`. If `last_reset_at::date = today (hotel tz)`, hide it for Reception.

**Filters (item 13)**
- Bug: "Done" filter uses stale `receptionStatuses`; fix the predicate so it counts every `status === 'done'` regardless of secondary flags (DND/Stayover/NR).
- Move **Clear filters** button next to **Filters** on the header row; remove it from the filter sheet.
- Add **Room type** multi-select to the filter sheet (source: `room_types` for current hotel).

**Reception help sheet (item 11)**
- Rewrite `src/components/reception-icon-guide.tsx` (rename intent, keep component) to include:
  - **Tile colors**: Red = not started, Green = serviced & ready for arrival, Blue = stayover, Purple = serviced non-arrival, Amber = staff/ROS, Grey = out-of-service, etc. (I'll match the actual palette in `app.tsx`.)
  - **Icons**: DND pill, NR pill (new), OUT badge, orange dot (message/maintenance), Bed (no bedtype yet), Wrench (maintenance flagged), Bell (notifications). Point users to Stayover Photos for the DND door image.

**Reception tile detail: pull lost property + maintenance (item 12)**
- When Reception opens a room's panel, also render:
  - Open maintenance requests for that `room_number` where `resolved_at IS NULL`.
  - Lost property items for that `room_number` where `collected_at IS NULL` (or whatever the current "not collected" predicate is).
  - If `status === 'DND'`, embed today's DND door photo via the existing `DndDoorPhoto` component.

## 4. Messages & logs (items 4, 5)

- Fix reply FK (covered above).
- **Reply to maintenance log from Reception/Housekeeping (item 5)**: today only Maintenance sees a reply affordance in the maintenance log; move that button to be visible to all departments that can view the log. The reply flow reuses the existing "Reply in Messages" composer, quoting the original message and posting into the maintenance thread.

## 5. Lost property (items 6, 9)

- **Countdown (item 6)**: replace the coarse label with a precise line like `Disposable in 6d 4h` (or `2h 15m` when < 1 day), using the existing `disposed_at`/retention window. Turns red in the last 24h.
- **Found-in department (item 9)**: on new-entry submit, stamp `found_by_department` derived from the current user's `sub_role`:
  - `housekeeper` → `HK`, `fnb` → `F&B`, `maintenance` → `MNT`, `reception` → `Reception`.
  - Render as a small badge on each row. Adds one nullable column `lost_property.found_by_department text`.

## 6. Settings menu visibility (item 8)

- In the settings sheet + dropdown, hide **Stayover Photos**, **Manage Rooms**, **Rejects**, and **Linen delivery days** when the user is F&B AND not an Admin/Manager/Regional Manager/Developer. All other roles keep current visibility.

## 7. Users panel (items 7, 14)

**Sort (item 7)**
- Add a `Select` next to the search box: Newest → Oldest (default), Oldest → Newest, A→Z, Z→A. Sort happens client-side on the already-fetched list.

**Approval flow revamp (item 14)**
- `UserApprovalDialog` today only asks for department. Replace approve action with a small form per pending user:
  - Hotel(s) — multi-select
  - Department(s) — multi-select
  - Position — single select (`user`, `manager`, `regional_manager`, `admin`, `developer`)
- Server function `approvePendingUser` gains: `hotelIds: string[]`, `departments: SubRole[]`, `position: AppRole`.
- Authorization inside the handler:
  - Admin / Regional Manager / Developer: unrestricted.
  - Manager: hotels limited to their own memberships, departments limited to their own, position limited to `<=` their own rank.
  - Anyone else: forbidden.
- Writes: `user_roles` (position), `hotel_members` (rows), `profiles.sub_role` (departments as array).

## Technical details

- Migration bundle:
  1. `alter type app_role add value 'developer'`
  2. `alter table hotels add column last_reset_at timestamptz`
  3. `alter table lost_property add column found_by_department text`
  4. `alter constraint room_messages_reply_to_id_fkey` → drop + recreate `on delete set null`
  5. Storage policy update for `entry-photos` maintenance path
  6. RLS updates: every `has_role(..., 'admin')` → `private.is_admin_like(auth.uid())` where `is_admin_like` returns true for admin OR developer OR regional_manager (only where the original policy allowed regional_manager, otherwise admin OR developer)
  7. `pruneSnapshots` retention → 7 days (code, not SQL)

- Types regenerate after migration; TS callers for new columns/enum come after.

- Reception Reset-all reuses `performResetAll` unchanged; only the visibility guard is new.

- The room tile "NR" indicator uses the same absolute-positioned slot as the DND pill; they are mutually exclusive on the tile since NR implies Stayover but not DND.

## Out of scope / not doing

- I will not rework broader RBAC beyond what items 14/15 require.
- Lost property retention window itself isn't changed — only the countdown display.
- No changes to push notifications, cron, or edge-side logic beyond what item 1 needs.

## Order of execution

1. Migration + role helper + attach types.
2. Reply FK, maintenance photo policy, DND cleanup wiring, snapshot retention.
3. Room status panel (NR button + staff reordering + tile pill).
4. Reception home: filters bug + clear-filters placement + room-type filter + reset-all guard + tile detail expansion + help sheet rewrite.
5. Messages: maintenance reply for Reception/HK.
6. Lost property: countdown + found-in badge.
7. Settings visibility for F&B.
8. Users: sort + approval revamp.

Anything you want to drop, defer, or reprioritize before I start?
