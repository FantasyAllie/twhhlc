# Match the maintenance workspace to the Maintenance Log

## What will change
- Rework the maintenance-only home view to use the same Open and Completed pill navigation as the Maintenance Log.
- Show the matching item count in each pill and render only the selected list.
- Limit both lists to 15 items per page.
- Add the same direct page-number navigation, ellipses, Previous, and Next controls beneath the pills.
- Keep maintenance-specific actions intact, including completing, reopening, replying to, deleting, and viewing photos.

## Technical details
- Update the existing maintenance dashboard rather than opening a second bottom panel.
- Preserve the combined open feed of maintenance requests and maintenance messages.
- Reset to the first page when switching between Open and Completed, and safely clamp the current page when list sizes change.
- Verify the maintenance role view at desktop and mobile widths and confirm the app builds cleanly.
