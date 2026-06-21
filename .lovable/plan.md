## Goal

Replace the native browser `confirm()` used for the "export already exists today" warning with a custom in-app dialog that has **Yes** / **No** buttons and the new copy.

## Changes (all in `src/routes/app.tsx`)

1. **Add state** for the confirmation dialog:
   - `confirmOverwrite: { kind: "totals" | "rejects" } | null` (null = closed).

2. **Refactor `openExport` and `openRejectExport`**:
   - Split each into two parts:
     - Trigger: if a same-day snapshot exists, set `confirmOverwrite` and return (dialog opens).
     - `proceedExport(kind)`: contains the existing delete-then-insert logic that runs after the user clicks Yes.
   - Remove both `confirm(...)` calls.

3. **Add an inline confirmation `<Dialog>`** near the existing dialogs:
   - Title: "Overwrite today's export?"
   - Description (totals): "A linen export already exists for today. Continuing will overwrite today's last history item. Please use the history feature to print previous exports. Would you like to continue with your export?"
   - Description (rejects): same wording but "rejects export".
   - Footer: two buttons — **No** (variant `outline`, closes dialog) and **Yes** (default, calls `proceedExport(kind)` then closes).

## Out of scope

No styling, schema, or other behavior changes. The History feature and snapshot logic remain identical.
