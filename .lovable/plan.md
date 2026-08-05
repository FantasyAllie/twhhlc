# Staged refactor of the main app screen

## Why

`src/routes/app.tsx` is 8,092 lines, and almost all of it is one component (`AppPage`, lines 260–7817) holding 86 pieces of screen state, 17 data queries, ~120 handler functions, and 33 sheets/dialogs in a single scope. That single scope is why unrelated features break each other, why fixes sometimes need two rounds, and why every linen tap re-renders the whole screen.

This is a pure restructuring. No visual change, no behaviour change, no database change. Every stage ends with the app working exactly as it does now.

## Ground rules for every stage

- Move code, don't rewrite it. Logic gets relocated as-is unless a duplicate is being merged into one shared version.
- Verify after each stage before starting the next: home screen loads for housekeeping and reception, room tiles and progress bar render, room detail and status sheets open, linen counting saves, Reset all works, print/export dialogs open.
- If a stage turns out to be messier than expected, it stops there rather than being forced through — the previous stages still stand on their own.

## Stage 1 — Types and pure helpers

Move the shared type definitions (`Room`, `TemplateItem`, `RoomCount`, `SnapshotRow`, `RoomMessage`, `MaintenanceRequest`, and friends) plus the small pure helpers into `src/lib/app-types.ts` and `src/lib/app-format.ts`.

Lowest-risk stage, and it makes the later stages readable.

## Stage 2 — Export and print logic

Extract into `src/lib/exports.ts`:

- `computeTotals`, `computeRejectTotals`, `computeRoomStatus`, `computeDeliveryLinenTotals`
- `deliveryWindow`, `retentionDaysFor`, `pruneSnapshots`, `saveSnapshot`
- the print HTML builders and date/ordinal formatting

These are mostly data-in/data-out functions and have been the single most repeatedly-edited area. Getting them into one tested module is the biggest immediate win.

## Stage 3 — Room status rules

Extract into `src/lib/rooms.ts`:

- the DND / Dirty / Not Required / done / checkout-flag rules
- `getRoomTileState`, tile colour and label logic
- `performResetAll`'s decision logic, so housekeeping and reception share one definition instead of two near-copies

This is where the divergence between the two roles has caused the most confusion, so it becomes one set of rules with role passed in as a parameter.

## Stage 4 — Data hooks

Split the 17 `useQuery` calls into per-domain hooks under `src/hooks/`:

- `use-rooms.ts` (rooms, room types, features, feature assignments)
- `use-linen.ts` (template items, room counts, fnb counts, rejects, extras, assignments)
- `use-messages.ts`, `use-maintenance.ts`, `use-lost-property.ts`, `use-snapshots.ts`

Query keys and invalidation behaviour stay identical — only their location changes.

## Stage 5 — Component extraction

Move UI out of the route file, in this order (most self-contained first):

1. `src/components/rooms/room-tile.tsx`, `room-grid.tsx`
2. `src/components/rooms/room-detail-sheet.tsx`, `room-status-sheet.tsx`
3. `src/components/settings/` — the settings menu and its sub-dialogs (export, print, manage rooms, manage items, linen delivery days)
4. `src/components/linen/` — housekeeping and F&B counting panels

Per the project's routing rules these are plain component files (never exported from the route file), so code splitting keeps working.

## Stage 6 — Route file cleanup

What's left in `src/routes/app.tsx` is role resolution, layout, and wiring — targeting a few hundred lines. Also confirms no stray module-scope references to route components were introduced, since that pattern crashes every route at runtime while still passing typecheck.

## Expected outcome

| | Before | After |
|---|---|---|
| Largest file | 8,092 lines | ~400 lines |
| Room status rules | scattered, duplicated per role | one module, one definition |
| Export logic | inline in the route | one module |
| Re-render on a linen tap | whole screen, all 33 sheets | the counting panel |

## Risk

The honest risk is a moved handler losing a subtle detail — a specific `invalidateQueries` call, an ordering dependency, a role check. Mitigation is the staged approach with verification between stages, and moving code verbatim rather than rewriting it. Nothing in this plan touches the database, RLS, or auth.
