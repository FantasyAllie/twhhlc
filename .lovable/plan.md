# Dirty-room completion outcome

## What will change
- Detect when the active housekeeping workload reaches its completed state while one or more rooms remain marked Dirty.
- Show a one-time sad full-screen effect only to the person whose action reached that state.
- Display: “You haven't finished all the rooms. Better luck next time”.
- Play a short sad-trombone sound during the effect.
- Keep the existing fireworks and “Congratulations” outcome for a genuinely complete shift with no Dirty rooms.

## Technical details
- Reuse the existing per-device, per-completion-cycle trigger pattern so neither outcome repeats until progress drops below completion and reaches it again.
- Add a separate lightweight visual component and CDN-hosted audio asset.
- Preserve the existing progress calculation, room rules, and all other completion behavior.
- Verify compilation and both trigger branches in the running preview.
