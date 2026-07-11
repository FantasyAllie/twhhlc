## Goal
Let users add a lost property entry directly from the Lost Property window, without going through the Messages sheet.

## UX
In `LostPropertySheet`, add a compact composer at the top of the scroll area (above the Open list):
- Room number input (numeric, optional for reception; required for housekeeping — mirrors current messages-sheet rule)
- Description textarea (required, trimmed, max ~500 chars)
- "Log item" button (disabled while empty/submitting)

Only users who can already see the sheet (admin / reception / housekeeping) can add. On success: clear the form, toast "Logged to lost property", list refreshes via the existing query invalidation. On failure: toast the error.

## Technical
- `LostPropertySheet` gains two props: `canAdd: boolean` and `onAdd: (roomNumber: number | null, message: string) => Promise<{ ok: boolean; error?: string }>`.
- Local state for `roomInput` and `message`. Validate: message non-empty; if user is housekeeping-only, room number required (pass a `requireRoom` prop derived in `app.tsx` from `myMessageDepartments`, matching the existing messages-sheet logic).
- In `src/routes/app.tsx`, reuse the existing `onLogLostProperty` insert logic — extract it into a local `logLostProperty` function and pass it both to `MessagesSheet` (unchanged behavior) and to the new `onAdd` prop on `LostPropertySheet`. Also pass `canAdd` (true when `menuCanUseLostProperty`) and `requireRoom` (housekeeping-only).
- No schema changes; `lost_property` insert path already exists and has RLS.

## Files touched
- `src/components/lost-property-sheet.tsx` — new composer UI + props + state
- `src/routes/app.tsx` — extract shared insert helper, pass new props to `LostPropertySheet`
