# Clean up the main room viewer (Admin & User)

Focus: make the linen counter and the Reception dropdown the easiest things to reach on mobile. Move secondary UI behind slide‑over sheets (Android‑style), collapse the notes panel, and shrink the grid indicators so the gold tick stops dominating.

All work is in `src/routes/app.tsx`. No schema or business‑logic changes.

## 1. Reception controls → bottom slide‑over sheets

Today the Reception button is a `DropdownMenu` that lists Done + every status + every bed type in one popup, and the Admin "edit defaults" pencil is another dropdown. On mobile these are small, scroll inside, and dim nothing.

Replace both with shadcn `Sheet` (`side="bottom"`) so they slide up from the bottom and dim the rest of the screen.

- New **Reception sheet** opened from the existing "Reception" button:
  - Big touch targets (min ~48 px row height), three labelled sections: **Done**, **Status**, **Bed**.
  - Each option is a full‑width row with the current check on the right (same selection logic as today, including the Double‑lock rule).
  - Tap outside / swipe down / drag handle closes.
- New **Edit defaults sheet** opened from the Admin pencil, same pattern, listing template items as toggle rows.
- Keep the "Extra linen" toggle as a plain inline button (it's a single tap, no menu needed).

## 2. Notes block → collapsible button at the top

The "For Reception" / "Leave a message for housekeeping" / vacated / maintenance block currently always renders above the linen list and pushes the counter down.

Collapse it into a single **Notes** button row at the top of the open room panel:

- One button labelled **Notes** with small status dots (amber if there's a housekeeping note or active message, emerald if guest vacated, wrench if maintenance) so state is visible without expanding.
- Tapping opens a bottom Sheet containing the existing content unchanged:
  - User/Admin view: the For‑Reception textarea + needs‑maintenance switch + vacated banner.
  - Reception view: vacated switch, maintenance banner, housekeeping note, and the housekeeping‑message composer/list.
- The Reception "Notes" dialog added previously is folded into this same sheet so there's one entry point, not two.

Result: the linen list sits directly under the room header on first paint.

## 3. Linen counter polish (no behaviour change)

- Bump the `+` / `−` / count buttons up to a consistent ~44 px tap target on mobile (`h-11 w-11` on `< sm`, current size on `sm:`).
- Keep the linen rows visually unchanged otherwise — colour swatches, lock state, extras section, totals all stay.

## 4. Room grid indicators

The yellow Reception‑done circle (`bg-yellow-500`, `h-5 w-5`, `ring-2`) sits on top of the room number and visually dominates. The new Reception‑vacated indicator currently uses the same emerald `DoorOpen` icon as in the open panel, which can be confused with the gold tick at a glance.

- Shrink the Reception‑done badge to `h-3.5 w-3.5` with a thinner ring, kept gold, bottom‑right.
- Replace the vacated indicator on the grid with a clearly distinct mark: a small **emerald pill containing "OUT"** (or a filled `DoorOpen` on an emerald square) anchored top‑left. Different shape (rect vs circle), different colour family, different corner — so it never reads as "the gold tick".
- Maintenance wrench and message dot stay as they are.

## 5. Out of scope

- No DB / RLS / migration changes.
- No changes to the printable Room Status Sheet, Reception filters, or Users page.
- No change to which roles can do what.

## Technical notes

- Uses existing `@/components/ui/sheet` (shadcn). If not yet present, add via `bunx shadcn@latest add sheet`.
- All selection handlers (`toggleReceptionDone`, `setRoomReceptionStatus`, `setRoomReceptionBed`, `toggleAssignment`, `setRoomHousekeepingNote`, `setRoomNeedsMaintenance`, `setRoomGuestVacated`, `submitRoomMessage`, etc.) are reused unchanged — only the container changes from `DropdownMenu` / inline block to `Sheet`.
- The existing `notesDialogRoom` state is replaced/extended by a single `notesSheetRoom` state; the standalone Dialog added in the previous turn is removed.
- Double‑bed lock logic in the bed list is preserved verbatim.
