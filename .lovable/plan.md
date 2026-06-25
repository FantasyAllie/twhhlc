# Push notifications for installed PWA

Add Web Push (VAPID) notifications so signed-in users can opt in and receive alerts for room messages, check-outs, and rooms marked done — on Android Chrome, desktop browsers, and iOS 16.4+ when the app is installed to the Home Screen.

## What users will see

- A **"Enable notifications"** toggle in the user menu/header (only shown when the browser supports push). First tap requests browser permission and registers the device.
- A short hint on iOS Safari explaining: "Install to Home Screen first, then enable notifications" (since iOS only supports push for installed PWAs).
- A small "Test notification" button right under the toggle so users can confirm it works.
- System notifications that tap-through to `/app` and the relevant room when clicked.

## Events that trigger a notification

1. **New room message** — sent to all opted-in users whose role is the opposite of the sender (housekeeping ↔ reception). Title: `Room {n} — Message from {sender}`, body: the message text.
2. **Guest checked out** — when reception flips `guest_vacated` to true. Sent to all opted-in housekeeping users. Title: `Room {n} — Guest checked out`.
3. **Room marked done** — when housekeeping flips `done` to true. Sent to all opted-in reception users. Title: `Room {n} — Marked done`.

Self-notifications are suppressed (the user who triggered the event does not get pinged).

## Technical details

### VAPID keys
- Generate a VAPID key pair once and store:
  - `VAPID_PUBLIC_KEY` — also exposed as `VITE_VAPID_PUBLIC_KEY` for the client
  - `VAPID_PRIVATE_KEY` — server-only
  - `VAPID_SUBJECT` — `mailto:` contact (asked from user, or default to a placeholder)

### Database
New migration adds:

- `push_subscriptions` table — one row per device/browser per user
  - `id uuid pk`, `user_id uuid` (auth.users), `endpoint text unique`, `p256dh text`, `auth text`, `user_agent text`, `created_at`, `last_used_at`
  - RLS: users can select/insert/update/delete only their own rows; service_role full access
  - Standard GRANTs

- `notification_preferences` table — per-user opt-in toggle
  - `user_id uuid pk`, `messages_enabled bool default true`, `checkout_enabled bool default true`, `done_enabled bool default true`
  - RLS owner-only; standard GRANTs

### Service worker
Add `public/sw.js` (kept tiny — push + notificationclick only, not an app-shell cache). Registered from a guarded wrapper that refuses to register in Lovable preview/dev/iframe contexts (per PWA skill rules). Manifest already exists; no offline caching added.

### Server functions (`src/lib/push.functions.ts`)
- `subscribeToPush({ endpoint, p256dh, auth, userAgent })` — upserts into `push_subscriptions` for the current user.
- `unsubscribeFromPush({ endpoint })` — removes the row.
- `getNotificationPreferences()` / `setNotificationPreferences({...})`.
- `sendTestNotification()` — sends a push to the caller's own subscriptions.

All use `requireSupabaseAuth`. Sending pushes uses the `web-push` npm package (Worker-compatible build) signed with the VAPID keys; failed/expired endpoints (404/410) are pruned automatically.

### Fan-out on events
A single `notifyRoomEvent` server function called by the three existing client mutations after the optimistic Supabase write succeeds:

- After `submitRoomMessage` — `kind: "message"`, payload `{ room_number, message, sender_username, sender_role }`.
- After `setRoomGuestVacated(n, true)` — `kind: "checkout"`.
- After `setDone(n, true)` (housekeeping side) — `kind: "done"`.

The server function:
1. Looks up app_users with the target role (opposite of sender) who have the matching preference enabled.
2. Loads their `push_subscriptions`.
3. Sends one web-push request per subscription with `{ title, body, url: "/app?room=" + n, tag: "room-" + n }`.
4. Excludes the originating user.

The trigger lives client-side (post-mutation) rather than as a DB trigger, because Supabase pg-net + edge functions for fan-out adds complexity we don't need at this scale.

### UI additions
- New `NotificationsToggle` component rendered in the existing user dropdown / settings sheet in `src/routes/app.tsx`.
- Detects support: `"serviceWorker" in navigator && "PushManager" in window && "Notification" in window`.
- On iOS Safari not installed: shows the install-first hint instead of the toggle.
- Persists the current device's subscription state by checking the active `PushSubscription` on mount.

## Out of scope (won't be done unless you ask)

- Offline / app-shell caching (notifications only need a tiny SW; full offline is a separate, larger change per PWA skill).
- Native iOS/Android apps via Capacitor.
- Email/SMS fallback when a user has no push subscriptions.
- Quiet hours / per-room mute.
- Notification history list inside the app.

## What I'll need from you to ship

Just a contact email for the VAPID `subject` (any address — used by push services to contact the sender if there's an abuse issue). I'll generate the VAPID keys automatically and store them as secrets.