
## 1. No overlapping tile icons
In both reception and housekeeping room-tile branches (`src/routes/app.tsx` ~5979–6132), the amber notification dot (`right-1 top-1/top-5`), the DND label (`right-1.5 top-2`), the OUT badge (`top-0.5 right-0.5`) and the maintenance wrench (`bottom-0.5 right-0.5`) share corners. I'll:
- Move the DND label to the top-left of the tile (below the room number) or center-top so it doesn't collide with the right-corner icons.
- Stack the amber message dot / OUT badge / wrench on distinct anchors:
  - OUT: top-right corner
  - Amber dot: top-right but shifted down when OUT badge is present (already done — extend to also shift down when DND label exists in reception branch)
  - Wrench: bottom-right (unchanged)
  - DND text: moved to top-left inline area so it never overlaps the amber dot.

## 2. Reception room-message → also posted in HK↔Reception chat
When Reception writes a room-tagged message (the "communications"/note flow that inserts into `room_messages`, ~lines 820, 852, 883), if the sender is Reception the message is stored with `thread: 'hk_reception'` and `room_number: <n>` so it appears in both the room's peek and the HK↔Reception chat feed. Right now some inserts use a non-thread scope; I'll ensure Reception's room note inserts include `thread: 'hk_reception'`. HK-originated room messages already thread into `hk_reception`, so they'll continue to appear in both places.

## 3. Reset all preserves chat messages
In `resetAll` (~line 1596), line 1696 deletes from `room_messages` per room. I'll change that so it deletes only room-scoped notes that are NOT part of a chat thread (i.e. `thread is null`), and leaves `thread='hk_reception'` etc. rows intact. The chat feed remains, and the room-tile amber dot clears because the peek query (`hasActiveMessage`) is already scoped to room-tagged notes only.

## 4. Maintenance / Lost Property toggles in `MessagesSheet`
In `src/components/messages-sheet.tsx`:
- Make the two switches mutually exclusive: turning one on turns the other off.
- When either toggle is on, `send()` short-circuits: it does NOT insert into `room_messages`, does NOT push to chat. It only calls `onLogMaintenance` / `onLogLostProperty`, then toasts "Maintenance request has been sent to the Maintenance Log" or "Item has been logged to Lost Property", clears the composer, and closes/reset toggles.
- Keep existing validation (room required for maintenance; room required for HK-only lost property).

## 5. Room panel: compact message peek
In the open-room detail panel (below the status/extra-linen/edit/communications button row), render a compact strip showing the latest active `hasActiveMessage` text (single line, truncated) with a small icon. Tapping it opens the notifications sheet (same UX as the amber dot). No inline dismiss/confirm — user opens notifications for that. I'll find the room-panel JSX in `app.tsx` (right after the action button row for the opened room) and add a `RoomMessagePeek` block.

## 6. Sitewide reply-to
Maintenance already opens `MessagesSheet` with `initialReplyTo`. Same wiring exists for HK-notifications and lost-property. I'll:
- Add a "Reply in Messages" action to the notifications-sheet items for housekeeping / reception / F&B (mirroring the maintenance action), passing `{ id, sender, snippet }` and the correct thread.
- Add a "Reply" action to lost-property items (in `LostPropertySheet`) so reception can reply into the appropriate thread (HK↔Reception by default) with the item text as reply-to snippet.

## 7. 10-tap easter egg on the rooms progress bar
In the progress-bar JSX (~line 6159), attach an `onClick`/`onPointerDown` counter (with a 700ms reset window between taps). On the 10th tap in a row:
- Open a `Confirm` dialog: "Reset everything? Approve to trigger a full reset."
- On approve: call the same `resetAll()` used by the Reset all button, then trigger a `<BroomBurst />` overlay: a fixed full-screen pointer-events-none layer that renders ~40 🧹 emoji at random positions with `animate-fade-in` + a scatter transform, auto-unmounting after 4s.
- On deny: close dialog.
Normal Reset all button behavior unchanged.

## Technical notes
- Files: `src/routes/app.tsx` (most changes), `src/components/messages-sheet.tsx` (toggles), `src/components/notifications-sheet.tsx` (reply buttons), `src/components/lost-property-sheet.tsx` (reply button), new `src/components/broom-burst.tsx`.
- No DB migrations needed. `room_messages.thread` is already nullable, so filtering `thread is null` in reset deletion is safe.
- Existing `notifyDepartmentMessage`/`notifyMaintenanceRequest` calls unchanged.
