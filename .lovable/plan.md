## Add F&B sub-role with shared linen counter

### Database
- Add `fnb` to the `app_role` enum.
- New table `fnb_linen_counts` — a single global counter shared across all F&B staff:
  - `template_item_id` (unique, FK to `template_items.id`)
  - `count` (int, default 0)
  - `updated_at`
- RLS + grants: signed-in users may read and update; admins/managers may delete/reset. Realtime enabled so admins viewing-as-F&B and multiple F&B users see live changes.
- Optional: extend `export_snapshots.kind` to accept `"fnb"` for the new export.

### Types & auth plumbing
- Extend `SubRole` to `"reception" | "housekeeper" | "fnb"` in both `src/lib/auth.functions.ts` and `src/lib/auth-client.ts`.
- Update the sub-role validator, role-splitting, and legacy compat mapping so a user with only `fnb` maps to a new effective view `"fnb"`.
- Add `"fnb"` to the `ViewRole` union in `src/routes/app.tsx` and to `availableViews` / `defaultView` for admin (and any user assigned the F&B sub-role) so admins can "View as F&B".

### Users dialog
- Add an "F&B" checkbox alongside Reception and Housekeeper in the sub-role selector.

### F&B home screen
- When `effectiveRole === "fnb"`, render a dedicated home screen instead of the room grid. Layout mirrors the Rejects sheet but as a full page:
  - Header: "F&B Linen Count"
  - List of `template_items` with −/+ buttons and a running total (identical UX to Rejects).
  - Reads/writes `fnb_linen_counts` (shared globally); realtime subscription keeps the tally in sync.
  - Reset button (admins/managers only) to zero all counts.
  - Print/Export button that produces a snapshot styled like the Rejects export ("Three Ways House Hotel F&B Linen Count") and saves an `export_snapshots` row with `kind: "fnb"`.
- Progress bar and reception help sheet are hidden in this view (F&B has no rooms).

### Settings menu for F&B users
- Signed in as F&B only: burger menu shows Linen List, Account, and Sign out. Everything room-related is hidden.
- Admins/Managers keep their full menu when viewing-as-F&B.

### Shared Linen List button behavior
- Linen List remains a single settings entry that edits `template_items` (still the shared master list of linen items — this is intentional so both counters use the same items).
- New behavior inside the Linen List sheet: when the signed-in user has BOTH `housekeeper` and `fnb` sub-roles (or is an admin/manager viewing-as-F&B while also having housekeeping context), show a segmented toggle at the top: **Housekeeping** / **F&B**.
  - Housekeeping tab: current per-room linen-list editor.
  - F&B tab: shows the F&B counter (same increment UI as the home screen) so a manager can adjust it from settings without leaving the current view.
  - Users with only one of the two sub-roles see just that tab and no switcher.

### Technical details
- The F&B home screen is a new component (`FnbHomeScreen`) rendered inline from `src/routes/app.tsx` when `effectiveRole === "fnb"`, gated before the reception/housekeeping branch.
- `fnb_linen_counts` mutations use optimistic updates via `qc.setQueryData(["fnb_linen_counts"], ...)` and a Postgres upsert on `template_item_id`.
- Realtime channel `fnb_linen_counts` invalidates the query on INSERT/UPDATE/DELETE.
- Export path reuses `handleExport`/`proceedExport`/`printExport` with a new `kind: "fnb"` branch and a matching history entry renderer.
- Access-control fixes: `assertApproved`/`is_approved` DB helper must include `fnb` so F&B users pass the RLS gate; server functions unaffected because `updateUserAssignment` already validates sub-roles via a whitelist we'll extend.
- Migration data step: no automatic assignments — admins assign F&B to specific users via the Users dialog.