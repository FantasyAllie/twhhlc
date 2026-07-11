## Goal
Attach up to 4 photos to lost property and maintenance entries — both when creating a new entry and later on existing entries. Photos are stored in Lovable Cloud (no third-party service needed).

## Storage design
- Private bucket `entry-photos` in Lovable Cloud storage.
- Object paths: `lost_property/<entry_id>/<uuid>.jpg` and `maintenance/<entry_id>/<uuid>.jpg`.
- RLS on `storage.objects` for this bucket: any authenticated user can SELECT / INSERT / DELETE (staff-only app; author/admin gating is enforced in the UI, matching current lost_property / maintenance patterns). No public access — display uses signed URLs (1h TTL).
- Add column `photo_paths text[] NOT NULL DEFAULT '{}'` to `public.lost_property` and `public.maintenance_requests` (holds up to 4 storage object paths per row).

## UX
**Composer (new entry) — both Lost Property sheet and the maintenance flow that lives inside the messages sheet:**
- "Add photos" button opens the standard file picker (`accept="image/*"`, no `capture` attribute → mobile shows Camera / Photo Library / Files).
- Thumbnails render inline with a × to remove before submit.
- Client-side compression to JPEG, max ~1600px long edge, quality ~0.8 (via `browser-image-compression` — small dep). Cap 4 photos, ~5 MB each pre-compression.
- On submit: insert the row first to get its id, upload each photo to `entry-photos/<kind>/<id>/<uuid>.jpg`, then update the row's `photo_paths`. If a photo upload fails, the entry still saves and we toast the specific failure.

**Existing entry — Lost Property sheet & Maintenance sheet list items:**
- Small camera icon on each row. Shown only to the entry's author (match on `created_by_username === current username`) or admins. Others see thumbnails read-only.
- Clicking opens a compact attachments popover: existing thumbnails (tap → lightbox), and an "Add" tile if under 4 photos. Each existing thumbnail has a trash icon (author/admin only).
- All thumbnails use signed URLs cached per session; the lightbox uses a longer-lived signed URL.

## Technical
**Migration** (single file):
- `ALTER TABLE public.lost_property ADD COLUMN photo_paths text[] NOT NULL DEFAULT '{}';`
- `ALTER TABLE public.maintenance_requests ADD COLUMN photo_paths text[] NOT NULL DEFAULT '{}';`
- Bucket + storage policies created via `supabase--storage_create_bucket` + a follow-up migration for `storage.objects` policies scoped to `bucket_id = 'entry-photos'` (authenticated: SELECT/INSERT/UPDATE/DELETE).

**New shared helper `src/lib/entry-photos.ts`:**
- `compressImage(file): Promise<Blob>` — uses `browser-image-compression`.
- `uploadEntryPhotos(kind, entryId, files): Promise<string[]>` — compresses, uploads, returns new paths.
- `getSignedUrls(paths): Promise<Record<string,string>>` — batched `createSignedUrls`, in-memory cache, 55-minute TTL.
- `deleteEntryPhoto(path)`.

**New shared component `src/components/entry-photos.tsx`:**
- `<PhotoComposer value onChange max=4 />` — used inside new-entry forms.
- `<PhotoAttachments kind entryId paths canEdit onChange />` — used on existing rows (thumbnail strip + add/remove + lightbox via a simple `Dialog`).

**Wiring:**
- `src/components/lost-property-sheet.tsx` — add `PhotoComposer` to the "Log a new item" form; add `PhotoAttachments` to each Open/Resolved row. `canEdit = isAdmin || row.created_by_username === currentUsername`. Extend the SELECT and insert/update to include `photo_paths`.
- `src/routes/app.tsx` — extend `logLostProperty` and the maintenance insert (line ~4018) so both do the "insert → upload → patch photo_paths" flow. Pass a `currentUsername` down where needed.
- Maintenance list UI (renders in `messages-sheet.tsx` for the reception↔maintenance thread) — surface `PhotoAttachments` beside each maintenance item. Add `photo_paths` to the maintenance select.

**Dependency:** `bun add browser-image-compression` (small, browser-only).

## Files touched / added
- Migration: add `photo_paths` columns + `storage.objects` policies for `entry-photos`
- New: `src/lib/entry-photos.ts`, `src/components/entry-photos.tsx`
- Edited: `src/components/lost-property-sheet.tsx`, `src/components/messages-sheet.tsx` (maintenance list + composer path), `src/routes/app.tsx` (insert helpers, selects, prop passing)
- `package.json` / `bun.lock` (new dep)
