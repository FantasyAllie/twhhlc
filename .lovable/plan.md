## Changes

### 1. Home-screen pills — sub-role assignment only

In `src/routes/app.tsx`, tighten `availableViews` so a pill only appears when the user actually holds that sub-role. Position (admin/manager) alone will no longer add pills.

```text
before: availableViews = admin/manager → all three pills
after:  availableViews = only the sub-roles the account is assigned
```

- `user` pill → only if `hasHousekeeperRole`
- `reception` pill → only if `hasReceptionRole`
- `fnb` pill → only if `hasFnbRole`

`canViewAs` becomes `availableViews.length >= 1` (so an admin with one sub-role can still toggle in/out of admin default; an admin with zero sub-roles sees no pills, matching the user's rule).

`defaultView` and F&B-only auto-default logic stay as they are.

### 2. Settings menu — always reflect real permissions, not the active pill

Today the burger menu uses `isAdmin` / `isFnb` / `isHousekeeper` / `isReception` derived from `effectiveRole` (i.e. the current pill). This is why toggling to F&B, for example, hides Maintenance Log and Notifications for an admin.

Introduce menu-only permission booleans derived from real identity:

- `menuIsAdmin = realIsAdmin || realIsManager`
- `menuHasFnb  = realIsAdmin || realIsManager || hasFnbRole`
- `menuHasHk   = realIsAdmin || realIsManager || hasHousekeeperRole`
- `menuIsFnbOnly = position === "user" && hasFnbRole && !hasHousekeeperRole && !hasReceptionRole`
- `menuIsReceptionOnly = position === "user" && hasReceptionRole && !hasHousekeeperRole && !hasFnbRole`

Swap the settings menu conditions (both desktop `DropdownMenu` around lines 2974–3036 and the mobile `Sheet` around lines 3774–3820) to use these instead of `isAdmin` / `isFnb` / etc:

- Linen List: `menuHasFnb || menuHasHk` (admins and anyone with fnb or housekeeper)
- Manage Rooms / Rejects / Bulk Room Status / History (admin block) / Users: `menuIsAdmin`
- "F&B history-only" fallback item: only for `menuIsFnbOnly`
- Maintenance Log: hide only for `menuIsFnbOnly` (an admin viewing as F&B still sees it)
- Notifications: hide only for `menuIsFnbOnly`

Room-view and home-screen rendering keep using `effectiveRole` — this change is scoped to the settings menu.

### 3. In-feature sub-role switcher

The Linen List dialog already has its Housekeeping/F&B toggle (`linenListType`) and gates it on assigned roles. No change needed there — the plan explicitly preserves it as the pattern for future shared features.

### Files touched

- `src/routes/app.tsx` — only the two blocks above (availableViews computation + settings menu conditions in the desktop DropdownMenu and mobile Sheet).

No schema, no other UI, no business logic changes.