## Goal

Restyle the Home Screen room tiles to look like the attached mockup (larger rounded cards with a colored top accent bar, room number in the top-left, a status word underneath, and a small status icon in the top-right), and replace the current 2-state color logic (red = not done, green = done) with a 4-state system driven by housekeeping progress.

## New color states (housekeeping view)

A room is in exactly one of these states:

```text
items counted?  done?   color   label
─────────────────────────────────────────
no              no      red     Not started
yes             no      yellow  In progress
no              yes     blue    Marked done
yes             yes     green   Complete
```

"Items counted" = the room has at least one row in `room_item_counts` with `count > 0` (template or extra). "Done" = the existing `done` flag (`doneSet`) that the Mark-as-done toggle already controls.

Existing overlays (DND text, OUT badge, maintenance wrench, message/note dot, reception-done check, staff lock, open-room ring, line-through when done) all stay; only the base tile color and shape change.

## Reception view

Reception's tile colors today already mirror the housekeeping done state. They will adopt the same 4-state palette so a glance at the grid means the same thing for both roles. DND text, OUT badge, staff lock, etc. continue to render on top.

## Tile shape

- Switch tiles from `aspect-square` to a wider rounded card (roughly `aspect-[4/3]` / `min-h-[64px]`) so the room number and the new status label both fit cleanly.
- Top edge gets a 3px colored accent bar in the state's strong color; card body uses the state's soft background and matching text color.
- Layout inside the card: room number top-left (larger), status label below it (small, same color family), small state icon top-right (sparkle = complete/done, dot/clock = in progress, alert = not started, check = done-no-items). All overlay badges keep their current corners.
- Grid column counts stay (`grid-cols-4 sm:grid-cols-8 md:grid-cols-10`) so the page still fits 50 rooms at a glance; only the row height grows slightly.

## Token strategy

Add four semantic token pairs to `src/styles.css` so the colors theme correctly and aren't hardcoded in the component:

- `--room-todo` / `--room-todo-fg` (red — not started)
- `--room-progress` / `--room-progress-fg` (yellow — in progress)
- `--room-done` / `--room-done-fg` (blue — done, no items)
- `--room-complete` / `--room-complete-fg` (green — done + items)

Tile renderer picks the pair from a small helper `getRoomState(room, doneSet, countsByRoom)` instead of the current inline `done ? green : red` style block.

## Files touched

- `src/routes/app.tsx` — derive `roomsWithCounts: Set<number>` once from `room_counts`, add the `getRoomState` helper, restyle both the reception and housekeeping `<button>` blocks (lines ~3968–4086), keep all overlays.
- `src/styles.css` — add the four token pairs in `:root` and `.dark`, mapped into `@theme inline` so `bg-room-todo` etc. work.

No data model, query, or business-logic changes — only presentation and a derived selector over data we already fetch.

## Out of scope

- No change to the Mark-as-done flow, counts entry, filters, or any sheet contents.
- Not copying the mockup's left sidebar, header chips ("Dirty 8 / Cleaning 3 / …"), or the page-level layout — only the tile visual.
- No change to the "X of Y done" progress text below the grid.

## Acceptance check

- Fresh room (no counts, not done) → red tile, "Not started".
- Add 1 to any item → tile turns yellow, "In progress".
- Mark room as done with no counts → blue tile, "Marked done".
- Mark done with counts present → green tile, "Complete".
- Toggling done off returns to red or yellow based on whether counts exist.
- DND text, OUT badge, maintenance wrench, message dot, staff-lock styling, and the open-room ring all still render on top of the new colors in both housekeeping and reception views.
