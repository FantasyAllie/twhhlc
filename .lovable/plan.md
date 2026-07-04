## Five changes

### 1. Room view: "Notes" → "Communications"

- The room-detail sheet title "Notes — Room N" becomes "Communications — Room N".
- The `StickyNote` icon on the sheet header AND on the room-tile button becomes `MessageSquare` (speech bubble). The tile button's `aria-label="Notes"` becomes `aria-label="Communications"`.
- Section labels inside the sheet ("For Reception", "Reception message(s)", etc.) stay — they describe direction, not the surface name.

### 2. "Sub-role" → "Department"; "Housekeeper" → "Housekeeping"

Terminology-only sweep across visible copy. Backend `SubRole` values (`reception`, `housekeeper`, `fnb`) and the `user_roles` rows stay as-is — this is a UI rename, not a schema change.

- Type/prop names in `auth.functions.ts` (`SubRole`, `subRoles`) keep their code identifiers so we don't touch the server contract, but any user-facing labels that read "sub-role", "sub role", or "sub roles" get replaced with "department" / "departments".
- User-visible "Housekeeper" strings become "Housekeeping" (role labels in the users dialog, approval dialog, role picker, etc.). Internal `"housekeeper"` role value is untouched.
- Files to sweep: `src/components/users-dialog.tsx`, `src/components/user-approval-dialog.tsx`, `src/routes/app.tsx` (role picker labels, menu section headers), any admin/manager copy referencing sub-roles.

### 3. Messages window: "Send to" picker

Replace the current 3-thread pill picker with a "Send to <department>" picker whose options depend on the current user:

- Housekeeping-only user → options: Reception, F&B
- Reception-only user → options: Housekeeping, F&B
- F&B-only user → options: Housekeeping, Reception
- Admin / Manager → options: Housekeeping, Reception, F&B (all three)
- Mixed sub-roles (e.g. HK + Reception) → union of what those departments can send to, deduped

Selection maps to the existing pair thread:
- Housekeeping → Reception  = `hk_reception`
- Housekeeping → F&B        = `hk_fnb`
- Reception   → F&B         = `reception_fnb`
- Admin picking a target: from their "identity" perspective — since Admin doesn't have a department, the second side of the pair is the target and admin sits on the other side. For the two threads that don't include the target's counterpart, admin is treated as that counterpart (e.g. Admin → F&B, if they don't hold HK or Reception, picks `reception_fnb` by default, or uses a small sub-picker "as Housekeeping / as Reception"). Keeping it simple: admins see three options — "Housekeeping ↔ Reception", "Housekeeping ↔ F&B", "Reception ↔ F&B" — labeled as "Send to <dept>" but the picker uses thread names under the hood.

Rendering in the feed stays a shared thread (both sides see all messages), just the composer picker changes.

### 4. "Also log as maintenance" toggle

- Only shown when the active thread is `hk_reception` (per your answer).
- Renders as a Switch below the composer input labeled "Also log as maintenance".
- When on: sending requires a room number (composer's existing room selector). Send does two writes: the normal `room_messages` insert AND a `maintenance_requests` insert (`room_number`, `message`, `created_by_username`) reusing the existing `submitMaintenanceRequest` shape. Success toast: "Message sent and logged for maintenance." Failure of either write shows a specific error.
- Toggle state resets to off after a successful send.

### 5. Mobile homescreen: fewer buttons, more thumb space

- On mobile only, remove **Role Picker**, **Export**, **Print**, and **Help** buttons from the homescreen strip (the block currently rendered around `isMobile && (canViewAs || ...)`). Filters stays visible.
- Add matching entries to the burger menu sheet, gated by the same rules that decide whether they render on desktop:
  - **Role Picker** — when `canViewAs` (≥2 assigned views). Opens the existing role-picker bottom sheet.
  - **Export** — when `isAdmin && !isReception`. Opens the existing export bottom sheet.
  - **Print** — when the user has print (`isAdmin && !isReception` for linen print; `isReception` for room-status print). Two menu items if both apply.
  - **Help** — when `isReception`.
- These entries go under a new "Actions" section in the mobile settings sheet, above the existing "Appearance" section. Desktop menu is unchanged.
- Result: a user in position `user` with only the Housekeeping department gets none of these entries — the menu shows only what they can actually use.

### Files touched

- `src/routes/app.tsx` — room-tile button icon/label, notes sheet title/icon, "Housekeeper"/"sub-role" copy, mobile homescreen strip, mobile burger-menu Actions section, MessagesSheet integration for maintenance toggle.
- `src/components/messages-sheet.tsx` — new "Send to" picker logic, `MessageSquare` room chip stays, add `alsoMaintenance` prop + Switch, send-time double write.
- `src/components/users-dialog.tsx`, `src/components/user-approval-dialog.tsx` — copy sweep (sub-role → department, Housekeeper → Housekeeping).

### Not touching

- Database schema, RLS, or role identifiers.
- Desktop layout of the homescreen strip.
- The room detail view's other sections (checkout toggle, maintenance switch, etc.).
