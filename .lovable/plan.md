## Overview

Three related changes:

1. Simplify the room "Communications" sheet and rename it to "Notifications".
2. Add a **Maintenance** department with its own home screen (a triage list, no room grid) and reply flow.
3. Add a **Lost Property** flow: a new button in the Messages sheet, plus a Lost Property log accessible from Settings (Reception + Housekeeping only).

---

## 1) Room sheet cleanup + rename

In `src/routes/app.tsx` around lines 3418–3688 (the `notesSheetRoom` sheet):

- Rename the title `Communications — Room {n}` → `Notifications — Room {n}`. Update the aria-label at ~line 2710 (`aria-label="Communications"` → `"Notifications"`).
- Remove the **"For Reception"** block (~lines 3628–3680) — the maintenance textarea + "Send to maintenance log" button. The Wrench/"Needs maintenance" switch also goes with it (maintenance logging now happens through Messages).
- Ensure Reception messages tagged with a room number appear in this sheet. The sheet already reads `activeMessagesByRoom(n)` — verify it includes the `hk_reception` thread messages tagged with the room. If it currently only reads legacy per-room messages, extend it to also pull `room_messages` where `thread='hk_reception'` and `room_number = n` (undismissed, not done, not deleted).

## 2) Maintenance department

### Schema changes (one migration)

- `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'maintenance'`.
- Extend `room_messages.thread` CHECK constraint to allow two new threads:
  `hk_maintenance`, `reception_maintenance` (so maintenance can reply in a shared feed with the originating dept). Drop the old CHECK, add a new one covering all five threads.
- Extend `handle_new_user()` (already handles pending) — no change needed; admins assign the role.
- Add `lost_property` table (see section 3).

### Role wiring (`src/routes/app.tsx`, `src/components/messages-sheet.tsx`)

- Add `isMaintenance = effectiveRole === "maintenance"` alongside `isReception`/`isFnb`.
- Extend `MessagesDepartment` union in `messages-sheet.tsx` with `"maintenance"`, add label "Maintenance", and add the two new threads (`hk_maintenance`, `reception_maintenance`) with labels. Update `threadFor()` and thread-pair derivation to cover maintenance pairs. `supportsRoomTag` returns true for the new maintenance threads too (room tag is meaningful).
- Reachability rules (~line 998): a maintenance user can message Reception + Housekeeping. Housekeeping and Reception can message Maintenance. F&B cannot.
- `myMessageDepartments`: add `"maintenance"` when the user has the maintenance role.

### Maintenance home screen

A maintenance user must NOT see the housekeeping room grid. Route change in `src/routes/app.tsx`:

- Near the top of the main render, branch: `if (isMaintenance) return <MaintenanceHome />;` — returns a full-screen list view (same header/settings menu chrome, no room tiles, no reception panel, no F&B panel).
- `MaintenanceHome` renders a stack of message tiles built from:
  - open `maintenance_requests` rows (existing table) — the primary source.
  - open `room_messages` rows on `hk_maintenance` / `reception_maintenance` threads (so ad-hoc messages surface too).
- Each tile shows: room number badge (if any), message body, sender username, timestamp, and three buttons:
  - **Done** — marks the item complete (`done=true` on `maintenance_requests`, or `done_at=now()` on `room_messages`).
  - **Delete** — soft-deletes (`deleted_at`).
  - **Reply** — opens the Messages sheet pre-filled to the correct thread and room. Reply target: the originating department + Reception. If it came from `maintenance_requests` (originating dept unknown for legacy rows), default to `hk_maintenance` and also post a mirror into `reception_maintenance` so Reception sees it. Going forward we'll stamp originating dept on new items.
- Realtime: subscribe to both `maintenance_requests` and `room_messages` and refetch on change.

### Settings menu on Maintenance accounts

The settings dropdown/sheet lives in `src/routes/app.tsx`. Gate items so maintenance users only see: Notifications, Account, Sign out, Dark mode, Messages. Hide: room settings, categories, snapshots/exports, users (unless admin), linen counts, maintenance log entry (their home IS the log), reception guide, department switcher (unless they have multiple roles).

### Push notifications

`notifyDepartmentMessage` in `src/lib/push.functions.ts` needs to route messages on the new threads to maintenance subscribers. Add `maintenance` as a recognised recipient department.

## 3) Lost Property

### Schema (same migration)

```
CREATE TABLE public.lost_property (
  id uuid PK default gen_random_uuid(),
  room_number int,                 -- required when sent from Housekeeping
  message text NOT NULL,
  created_by_username text,
  created_by_role text,            -- 'housekeeping' | 'reception'
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','collected','discarded')),
  resolved_by_username text,
  resolved_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
Plus GRANTs to authenticated + service_role, RLS enabled, and policies allowing SELECT/INSERT/UPDATE to any authenticated user (reads are already scoped to app UI to reception+housekeeping). Add an `updated_at` trigger.

### Messages sheet button (`src/components/messages-sheet.tsx`)

- Alongside the existing `alsoMaintenance` Switch (Wrench icon), add a matching `alsoLostProperty` toggle (Package/BaggageClaim icon). Same rules:
  - visible on `hk_reception` and `reception_maintenance`? — actually only when the message is going **to Reception** (i.e. sender is HK or Reception). Show on `hk_reception` thread only.
  - When Housekeeping sends: require a tagged room; disable the toggle otherwise.
  - When Reception sends: room tag optional.
- On send with the toggle on, insert a `lost_property` row in addition to the normal `room_messages` insert. Include sender's dept in `created_by_role`.

### Lost Property window

- New sheet component `src/components/lost-property-sheet.tsx` styled like the maintenance log.
- Entry point in the Settings menu, visible only to Reception + Housekeeping (and admin/manager) — hidden for F&B and Maintenance.
- Lists open items first, then resolved (last 24h) grouped by status. Each row shows room, message, sender, timestamp.
- Reception (and admin/manager) sees two action buttons:
  - **Collected by guest** → sets `status='collected'`, `resolved_at=now()`, `resolved_by_username=me`.
  - **Throw away** → sets `status='discarded'`.
- Housekeeping sees the list read-only (plus a delete on their own entries within e.g. 5 minutes — optional; simpler: view only).
- Realtime subscription on `lost_property`.

## Technical notes

- Files touched: `src/routes/app.tsx`, `src/components/messages-sheet.tsx`, `src/lib/push.functions.ts`, new `src/components/lost-property-sheet.tsx`, new `src/components/maintenance-home.tsx` (or inline in app.tsx), one new SQL migration.
- No changes to `client.ts` / auto-generated files.
- Thread CHECK constraint replacement is the risky part of the migration — do it as `DROP CONSTRAINT ... ADD CONSTRAINT ...` in a transaction so no partial state.
- `app_role` enum values can't be removed later, so `'maintenance'` is a one-way addition (fine).

## Out of scope

- Retro-tagging existing `maintenance_requests` rows with origin dept — new rows only.
- Migrating the old per-room message system; we keep `activeMessagesByRoom` as-is except to include tagged `room_messages`.

## Open questions

1. When a Housekeeping user selects a room and posts a **Lost Property** message, do you also want that message to appear in the room's Notifications sheet (like Maintenance-tagged messages do), or is the Lost Property log the only destination?
2. Should Maintenance accounts be able to see F&B messages at all (e.g. spilled drink → maintenance)? Current plan says no — F&B talks to Reception, Reception forwards to Maintenance. Confirm?
3. For the Maintenance Reply button: should the reply go to a shared thread visible to both the originator's dept AND Reception in one place, or two separate messages (one per dept)? Plan uses one thread; Reception sees maintenance↔hk and maintenance↔reception separately.