
## 1. Lock bed type to Double for Double rooms

In the Reception dropdown bed-type list (`src/routes/app.tsx` ~L1697-1732):

- If the room's `category` is `"double"` (and not also super king), hide every other bed option and force the Double item to render as selected and non-toggleable (clicking it does nothing).
- When such a room is saved, ensure `reception_bed_id` is set to the Double bed id automatically on first interaction with the room (so exports/filters reflect it without Reception clicking anything).
- The existing filter already strips `king`/`twin` for Double rooms; extend the same block to also strip everything except `double`.

No schema change needed.

## 2. Helpful info Housekeeping → Reception

Two additions, both shown inside the Reception room panel (read-only for Reception, editable by Housekeeping/Admin):

### a) Housekeeping note (free text, per room)
- New column `rooms.housekeeping_note text` (nullable).
- Housekeeping/Admin: small "Note" button on each room card → dialog with textarea → saves to `rooms.housekeeping_note`. Clearing the field removes the note.
- Reception: if a note is present, render it in the room panel as a callout block ("Note from Housekeeping: …"). No edit controls.
- Note is cleared automatically when the room is marked Done by Housekeeping? → No, keep it sticky; Housekeeping clears it manually so info isn't lost between cleans.

### b) Maintenance flag (boolean, distinct from Room out of Service)
- New column `rooms.needs_maintenance boolean not null default false`.
- Housekeeping/Admin: toggle in the existing Edit/room actions menu ("Needs maintenance").
- Reception: when true, room tile shows a wrench icon + amber accent; room panel shows a "Maintenance requested" banner. Room remains usable (unlike Room out of Service).
- Included as a column in the Reception export.

Both fields are loaded with the existing rooms query (no extra round trips). RLS: same policy as existing `rooms` columns.

## 3. Expand Reception filter with status multi-select

Current filter (`receptionFeatureFilter`) only handles features. Extend the same dropdown:

- Add `receptionStatusFilter: string[]` state (status ids from `receptionItems` where `kind === "status"`).
- Restructure the dropdown content into two labelled sections inside one popover:
  - **Status** — checkbox list of all reception statuses + a synthetic "Room out of Service" entry (so Reception can isolate OOS rooms).
  - **Features** — existing checkbox list.
- Trigger label updates to show combined count, e.g. `Filters · 2`.
- Filtering rule (AND across groups, AND within each group, matching the existing feature behaviour):
  ```
  visibleRooms = allRooms.filter(n => {
    const r = rooms.find(x => x.room_number === n);
    const statusId = r?.reception_status_id ?? r?.default_status ?? null;
    const statusOk = statusFilter.length === 0
      || statusFilter.includes(statusId ?? "__none__");
    const featuresOk = featureFilter.every(fid =>
      assignments.some(a => a.feature_id === fid && a.room_number === n));
    return statusOk && featuresOk;
  })
  ```
- "Clear filters" clears both status and feature selections.

## Technical notes

- Single migration adds `housekeeping_note` and `needs_maintenance` to `public.rooms`; no new tables, existing RLS/grants cover them.
- All UI work stays in `src/routes/app.tsx`; the rooms select on ~L278 gains the two new columns and the `Room` type is updated accordingly.
- Locked-Double behaviour is presentation-only plus a one-time write of `reception_bed_id` so exports remain accurate.
