# Room hub — reworking the room view's messages button

Yes, it makes sense. Here's what I'll build.

## The button

The small square button in a room view (currently a speech bubble labelled "Notifications") becomes an inbox-style icon — a tray with a down arrow — so it reads as "everything for this room". The existing coloured dots for unread messages, notes, maintenance and checkout stay on it.

The panel it opens is renamed from **"Notifications — Room 12"** to **"Room hub — Room 12"**, with the subtitle "Messages, logs and room info".

## Inside the panel, top to bottom

1. **Two buttons side by side**
   - **All Messages** — opens the existing messages panel, showing every message for the departments you're assigned to.
   - **New Log** — expands to three choices: **Maintenance issue**, **Lost property**, **Message reception**. Picking one closes the hub and opens that logging tool with its composer already open and the room number pre-selected, so nothing has to be typed twice.
2. **Guest & room info** — unchanged: the flags that have been set, each removable with the bin button or by swiping it away.
3. **Three info tiles** — the same row reception already has at the bottom of a room view: blue **DND photos**, red **Lost property**, orange **Maintenance**, each with a count. Tapping one expands that room's details underneath; tapping again closes it. Tiles only appear when there's something to show.

## Notes

- Only presentation and wiring changes — no change to what gets saved, who can see what, or any rules.
- Every action keeps a normal tappable button; swipe stays an extra.

## Technical outline

- `src/components/rooms/notes-sheet.tsx`: retitle, add the All Messages / New Log header row (New Log as a small expanding group), and add the three-tile info row with the expandable content, extracted from the reception block in `src/routes/app.tsx` (~lines 3078–3215) into a shared `RoomInfoTiles` component in `src/components/rooms/room-info-tiles.tsx` so reception and the hub render identically.
- New props on `RoomNotesSheet`: `onLogMaintenance(room)`, `onLogLostProperty(room)`, `onMessageReception(room)`, plus the data the tiles need (`maintenanceRequests`, `lostPropertyOpenItems`, `receptionStatuses`).
- `src/routes/app.tsx`: handlers that set `newMaintenanceRoom` + `maintenanceComposerOpen` then open `MaintenanceLogSheet`; open `LostPropertySheet` with new optional `initialAddRoom` / `openComposer` props; and `setMessagesInitial({ thread: "hk_reception", room: n })` for the reception message.
- `src/components/lost-property-sheet.tsx`: accept `initialAddRoom?: number | null` and `openComposerOnOpen?: boolean`, applied in the existing `useEffect` that runs on open.
- Icon: `Inbox` from lucide-react, replacing `MessageSquare` on the room action button.
