- Menu-opened Sheets/Dialogs render in place of the home screen via the takeover slot in ui/sheet.tsx (armSheetTakeover before opening); why: one consistent in-page panel pattern instead of popups.
- On iPhone, More and primary tab screens use the takeover slot with hideClose; screen height is measured against the floating tab bar's top edge so navigation stays available without covering content.
- Room item selectors use hotel-scoped editable settings and current selections on rooms, saved through an authenticated per-item database function; completion snapshots are saved atomically with done through a database function; why: optional persistent selections without pop-ups while preserving immutable exported records.
- Marking a room done closes the room view by collapsing the open room slot and clearing the status view inside the collapse callback; why: marking done ends the visit to that room, and clearing the status view before the collapse would flash the room hub mid-animation.

