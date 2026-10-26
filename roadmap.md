
## Dirty-room completion outcome
- [x] Replace AI PDF reading with a fixed-format reader; verify all 48 rooms and notes from the real export and run 20 passing tests
- [ ] Verify signed-in Paperwork upload and preview; blocked because no preview session could be minted for the requesting account
- [x] Exclude Dirty rooms from the visible rooms progress counter/total
- [x] Treat Dirty rooms as satisfying 100% so completion still fires
- [x] Sad full-screen outcome + sad trombone sound when completion happens with Dirty rooms present

## Current work
- [x] Make floor pills a compact segmented control matching the department picker on desktop, tablet and phone
- [x] Fix tablet top bar position and appearance spacing; replace tablet tabs with menu Home and verify navigation

- [x] Centralise floors, room assignments and inventory cupboard names in Floors & Cupboards
- [x] Verify saved floor assignments and matching inventory cupboard names
- [x] Show paperwork CLEAN / ARRIVAL with the Not Started tile colour and verify the mapping
- [x] Route Reception room comments to Housekeeping and verify sending and readback
- [x] Replace paired messages with department groups, enforce access and verify sending with sender names
- [x] Add and verify a daily 11pm UK-time export for missing daily reports
- [x] Move Leaderboard into Daily Operations and allow all Housekeeping-assigned users
- [x] Reduce room controls top gap; move Messages Show done far right
- [x] Frost iOS centred logging popups and audit OS controls
- [x] Omit assigned-department tabs and test maintenance-only navigation
- [x] Tighten mobile room action spacing and replace Home filter squares with platform-styled highlighted options
- [x] Remove the Messages screen description on phones and put Show done opposite the title
- [x] Enable and verify Home pull-to-refresh sync on iOS and Android
- [x] Prevent clipped iOS shadows across shared panels and verify room tabs, linen and full-screen scrolling
- [x] Keep room tabs fixed across views, eliminate first-open collapse, and hide inline Edit/Room hub headings and descriptions
- [x] Verify seamless room switching and button positions without modifying room records
- [x] Make Status, Extra linen, Edit and Room hub toggle inline views with persistent room navigation
- [x] Verify long-press Status and room-tile return-home behaviour without changing room data
- [x] Remove the shortcut cards from the F&B and Maintenance home screens and verify their panels still open
- [x] F&B: rename Export to Export & Print and overwrite the same-day export without asking
- [x] Remove the shortcut cards entirely from every department's home screen; panels open from the settings menu only
- [x] Give the Maintenance home header its own subtitle instead of the Housekeeping one
- [x] Put the counter controls below the centred item name on every linen count row
- [x] Put linen item names to the left of the counting controls on wider screens, keeping phones stacked
- [x] Remove the F&B Linen List entry from the settings menu



- [x] Add an Edit linen list button to the F&B home screen header and verify it opens and closes the list

- [x] Close the room view back to the room tile grid when a room is marked done
- [x] Skip the bed area on the room status screen when a room has only one bed option (Double)

- [x] Move optional item selectors below Bed and above Mark as Done, remove the pop-up, and verify saving and completion
- [x] Drop Reception's inner inset frame so the room panel has a single enclosure
- [x] Rename the room checklist section to "Checked Items" with the checked-room sentence
- [x] Simplify Reception room heading and bed display
- [x] Show ticked checklist items beneath features and replace flag switches with two-column accent toggles
- [x] Verify Reception room view with saved checklist data
- [x] Reposition Mark as Done between dividers
- [x] Add editable room completion checklist and completed records
- [x] Verify checklist requirements and editor controls without changing live room records
- [x] Fix mobile toggle thumb sitting outside the pill
- [x] Fart sound when a room is marked Dirty
- [x] Urgent option on maintenance requests + Urgent pill between Open and Completed
- [x] Open list keeps posting order — no urgent priority there

- [x] iPhone: taller top bar with a 60%-to-0% fade, icon-only Quick Setup, progress ring sized to match
- [x] iPhone: More opens as its own screen, tab screens have no Close button, and scrollable content ends above the floating tab bar
- [x] Show the Quick Setup button as its bell icon only on phones, iPhone and Android alike

## Current request (Allie, 18 Oct)
- [x] iOS top bar blur: shrink so the blur bottom sits even with the Quick Setup / progress ring buttons
- [x] Fix first-open of Status/Extra linen/Edit/Room hub: tiles below jump up as the panel mounts
- [x] Fix iOS screens occasionally opening as slide-up panels instead of full-screen on first open
- [x] Room hub maintenance/lost-property logging on iOS: centred popup (like shift progress card), not the full log windows
- [x] Tablet iOS = mobile iOS: bottom tab bar, no More/menu button in top bar, iOS-styled menu box + department pill
