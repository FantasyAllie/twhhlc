# Fix mobile toggles and add urgent maintenance

## What will change
- Rebuild the toggle layout so its thumb is positioned by the pill itself, never by overlapping mobile transforms; verify both on and off states on a narrow mobile viewport.
- Play a short, lighthearted fart sound when a room is newly marked Dirty, while respecting the existing button-sounds preference.
- Add an Urgent action option to maintenance requests, available when logging a request and on existing request cards.
- Add an Urgent pill between Open and Completed in both maintenance views. Urgent requests also stay in Open, which keeps its normal newest-first posting order with no urgent preference.
- Keep the existing 15-item pagination and all current notes, photo, completion, reopen, reply, and delete actions.

## Technical details
- Store urgency on maintenance requests so it persists and syncs across users and devices.
- Include urgency in maintenance queries and shared types, and allow it to be toggled without changing completion state.
- Urgent applies to maintenance-request records; maintenance-thread messages remain regular Open items.
- Use the existing semantic colours and control components.
