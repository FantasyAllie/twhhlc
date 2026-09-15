# Make the app friendlier to use with one thumb

Three changes across the whole app: every control big enough to hit reliably, the main
buttons moved within thumb reach, and swipe gestures so you tap small things less often.

## 1. Bigger, safer targets

- Every tappable control gets a minimum height and width of 44px on phones, keeping the
  current smaller sizing on desktop. Affects: filter pills, page-number buttons, the
  Notes / Done / Delete / Reply rows in the maintenance log and lost property, linen and
  delivery counter buttons, quick-setup toggles, settings rows, close buttons.
- More space between neighbouring buttons so a slightly-off tap doesn't hit the wrong one.
- Destructive buttons (Delete, Reset all) get visual separation from the safe buttons next
  to them, so they are never the accidental hit.
- Room tiles keep their current size, but their tap area extends to the full tile.

## 2. Main actions within thumb reach

- Panels that scroll (room status, maintenance log, lost property, linen, delivery,
  settings, reports) get their primary action pinned to the bottom of the panel, above the
  phone's home bar, instead of sitting at the top out of reach.
- Forms with a text box (notes, messages, log a new item / issue) get a sticky Save bar
  that rides above the keyboard rather than being hidden behind it.
- Top-of-panel controls stay where they are for reference, but no longer hold the only
  copy of the main action.

## 3. Swipe gestures

- Swipe a list item sideways in the maintenance log and lost property to reveal Done and
  Delete, with a confirm step on Delete.
- Swipe left/right across a list to move between the Open / Completed / Expired filters,
  and between pages, so the small numbered buttons become optional.
- Pull down to refresh on the home grid and on each log panel.
- Existing long-press-to-open on room tiles is preserved and must not be triggered by a
  swipe.

## Technical notes

- Sizing: introduce shared size tokens/utility classes (e.g. a `touch-target` utility in
  `src/styles.css`) and apply them via the existing shadcn `button` variants plus the
  bespoke `h-7` / `h-8` classes in `src/routes/app.tsx`,
  `src/components/ops/maintenance-log-sheet.tsx`,
  `src/components/ops/maintenance-dashboard.tsx`,
  `src/components/lost-property-sheet.tsx`, `src/components/linen/*`, and the settings
  menus. Desktop keeps `sm:`/`lg:` overrides so nothing grows on large screens.
- Sticky action bars: add a footer region in `src/components/ui/sheet.tsx` content wrapper
  using `sticky bottom-0` with `env(safe-area-inset-bottom)` padding, matching the existing
  safe-area handling in `app.tsx`. Keyboard avoidance via `dvh` units already in use.
- Gestures: one small shared hook (`src/hooks/use-swipe.ts`) built on pointer events —
  no new dependency. Horizontal-intent threshold plus `touch-action: pan-y` on rows so
  vertical scrolling always wins, and a movement cancel that clears the 500ms long-press
  timer in `src/components/rooms/room-tile.tsx`.
- Pull-to-refresh: same hook, triggering `queryClient.invalidateQueries` for the panel's
  query keys; disabled when the list is not scrolled to the top.
- Reduced-motion and keyboard/desktop paths keep working: every swipe action still has an
  equivalent visible button.
- No changes to data, permissions, or business rules.
