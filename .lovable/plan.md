## Goal

Make it fast to set the **reception status** and **bed type** for many rooms in one place, without opening each room individually. Today you have to tap a room → open its reception sheet → pick status → pick bed → close → repeat. The new view shows every room at once with one-tap chips.

## What you'll see

A new full-height sheet titled **"Quick reception setup"**.

Inside it: a single scrolling list, one row per room, sorted by room number.

Each room row shows:

```text
┌───────────────────────────────────────────────────────────┐
│ Room 101            (room type label, small, muted)       │
│                                                           │
│ Status:  [ Vacant ] [ Occupied ] [ Arrival ] [ Departure ]│
│ Bed:     [ Single ] [ Double  ] [ Twin    ]               │
└───────────────────────────────────────────────────────────┘
```

- Each chip is a tap target. Tapping a chip selects it; tapping the already-selected chip clears it back to "no override" (same toggle behavior as the current single-room reception sheet).
- The currently-selected chip is filled (matches the existing `Row selected` visual from the reception sheet, but rendered horizontally as pills).
- Bed chips are filtered by room category the same way the single-room sheet filters them, including the "double-only" lock (the Double chip is shown pre-selected and disabled for those rooms).
- No Save button. Each tap writes immediately, with the same optimistic update + Supabase upsert the single-room sheet already uses.
- No search/filter. Full list, scroll to the room you want.

## Where it opens from

Two entry points, both opening the same sheet:

1. **Settings menu → Manage section** — new row `Quick reception setup` (icon: `ConciergeBell` or `ClipboardList`, matching existing menu icons), placed under "History".
2. **Inside any room's reception sheet** — a small secondary button at the top right of the sheet header, label `Edit all rooms`. Tapping it closes the single-room sheet and opens the bulk sheet.

Both are gated by the same role check the current reception sheet uses (admin or reception — match the existing visibility rules; no new permissions).

## How saving works

- Reuses the existing `setRoomReceptionStatus(n, id)` and `setRoomReceptionBed(n, id)` wrappers (`src/routes/app.tsx` ~1487–1490). Those already do optimistic cache updates and upsert into `rooms` on conflict `user_id,room_number`, then invalidate `["rooms"]`.
- No new server function, no new table, no new migration. Same write path as the per-room sheet, so realtime/notifications behave identically.

## Out of scope

- No bulk "apply to all" action (e.g. "set every room to Vacant"). Can be added later if you want it — say the word and I'll fold it in.
- No grouping by floor/type and no filters (per your answers).
- No changes to room defaults, room types, linen, or any other room field — only `reception_status_id` and `reception_bed_id`.

## Technical notes

- New component `src/components/quick-reception-sheet.tsx` exporting `QuickReceptionSheet({ open, onOpenChange })`. Self-contained: pulls `rooms`, `reception_items`, and `roomTypes` from the existing React Query keys (`["rooms"]`, `["reception_items"]`, `["room_types"]`) via `useQuery` so it shares cache with the rest of the app and benefits from the same optimistic updates.
- Reuses the same per-room bed-filtering logic that lives in the reception sheet (extract a small helper `filterBedsForRoom(room, beds, roomTypes)` so both places call the same code instead of duplicating the "only double" rule).
- Wires in `src/routes/app.tsx`:
  - Adds `quickReceptionOpen` state.
  - Adds the "Quick reception setup" row inside the menu's Manage block (`~2756–2762`).
  - Adds an "Edit all rooms" button to the reception sheet header (`~2660`) that calls `setReceptionSheetRoom(null)` then `setQuickReceptionOpen(true)`.
  - Renders `<QuickReceptionSheet open={quickReceptionOpen} onOpenChange={setQuickReceptionOpen} />` near the existing dialogs at the bottom of the route.
- Sheet uses `side="bottom"` with `max-h-[90vh] overflow-y-auto`, matching the existing `exportSheetOpen` / `notificationsSheetOpen` pattern, so it works well on the 390px mobile viewport.
- Chips are buttons styled with existing token classes (`bg-secondary`, `bg-primary text-primary-foreground` when selected, `opacity-50` when the bed lock applies). No new design tokens, no hardcoded colors.

## Acceptance check after build

- Open menu → tap **Quick reception setup** → sheet opens listing every room.
- Tap a Status chip on room 101 → row updates instantly, close sheet, reopen the single-room reception sheet for 101 → same status is shown.
- Tap the already-selected Status chip → it clears (back to default).
- Open a single room's reception sheet → tap **Edit all rooms** → bulk sheet opens with the room you just edited reflecting its new value.
- Double-only rooms show Double pre-selected, chip disabled, no other bed selectable.
