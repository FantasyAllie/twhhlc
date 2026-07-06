## Goal
Make maintenance replies show the original message as a WhatsApp-style quote block — a bordered, tinted card attached above the reply text — instead of pre-filling the composer with inline `> quoted` text.

## UX
When a Maintenance user taps **Reply** on a maintenance item:
- The composer no longer pre-fills any text.
- Above the textarea (and inside the sent message bubble in the feed) a small quote card appears:
  - Left accent bar (primary color)
  - Bold sender name on top (e.g. "Reception" or username)
  - Original message text below, truncated to ~2 lines with ellipsis
  - Small "×" button in the composer preview to cancel the reply
- After sending, the recipient sees the same quote card rendered at the top of the message bubble, then the reply text below — matching the WhatsApp reference.

## How it works (technical)

**Data model**
- Add nullable columns to `public.room_messages`:
  - `reply_to_id uuid` (nullable, references room_messages.id, ON DELETE SET NULL)
  - `reply_to_sender text`
  - `reply_to_snippet text` (store snapshot so quote survives if original is deleted; capped ~280 chars)
- Migration includes GRANTs (already present on table) — just ALTER TABLE.

**`src/routes/app.tsx`**
- Replace `initialText` prefill with a new `initialReplyTo` object: `{ id, sender, snippet }`.
- `replyToItem(it)` now sets `messagesInitial = { thread, room, replyTo: { id: rawId(it.id), sender: it.sender ?? "Someone", snippet: it.message } }` and opens the sheet. No text prefill.
- Remove the quoted `> ...` / `Re:` string construction.

**`src/components/messages-sheet.tsx`**
- Replace `initialText` prop with `initialReplyTo?: { id, sender, snippet }`.
- Local state `replyTo` initialised from prop, cleared on send or via the × button.
- Render a WhatsApp-style quote card above the textarea when `replyTo` is set (rounded-md, `bg-muted`, left border-l-4 `border-primary`, sender bold, snippet line-clamp-2).
- On send: include `reply_to_id`, `reply_to_sender`, `reply_to_snippet` in the insert payload; clear `replyTo` after.
- In the message list rendering, if `m.reply_to_snippet` is set, render the same quote card at the top of the bubble (above `m.message`).
- Extend the `Msg` type and select list to include the new columns.

**No behavioural changes** to done/undo/delete, notifications, or other threads. The quote card is purely additive.

## Files touched
- New migration (add 3 columns to `room_messages`)
- `src/routes/app.tsx` — replyToItem + prop passed to `MessagesSheet`, `messagesInitial` shape
- `src/components/messages-sheet.tsx` — prop, state, composer preview, bubble rendering, insert payload, Msg type & select
