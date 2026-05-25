
-- 1. Drop FK constraints to auth.users so we can stop tying data to accounts
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_user_id_fkey;
ALTER TABLE public.template_items DROP CONSTRAINT IF EXISTS template_items_user_id_fkey;
ALTER TABLE public.room_extra_items DROP CONSTRAINT IF EXISTS room_extra_items_user_id_fkey;
ALTER TABLE public.room_item_counts DROP CONSTRAINT IF EXISTS room_item_counts_user_id_fkey;

-- 2. Dedupe rooms before collapsing to single owner
DELETE FROM public.rooms r
USING public.rooms r2
WHERE r.room_number = r2.room_number
  AND (r2.done::int, r2.updated_at, r2.id) > (r.done::int, r.updated_at, r.id);

-- 3. Collapse counts across users
CREATE TEMP TABLE _counts_merged ON COMMIT DROP AS
SELECT room_number, item_kind, item_id, SUM(count)::int AS total, MAX(updated_at) AS updated_at
FROM public.room_item_counts
GROUP BY room_number, item_kind, item_id;

DELETE FROM public.room_item_counts;

-- 4. Reassign all data to shared sentinel owner
UPDATE public.template_items SET user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.room_extra_items SET user_id = '00000000-0000-0000-0000-000000000000';
UPDATE public.rooms SET user_id = '00000000-0000-0000-0000-000000000000';

INSERT INTO public.room_item_counts (user_id, room_number, item_kind, item_id, count, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', room_number, item_kind, item_id, total, updated_at
FROM _counts_merged;

-- 5. Default owner for future inserts
ALTER TABLE public.template_items ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.room_extra_items ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.room_item_counts ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.rooms ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- 6. Replace per-user policies with public-access policies
DROP POLICY IF EXISTS template_items_select_own ON public.template_items;
DROP POLICY IF EXISTS template_items_insert_own ON public.template_items;
DROP POLICY IF EXISTS template_items_update_own ON public.template_items;
DROP POLICY IF EXISTS template_items_delete_own ON public.template_items;

DROP POLICY IF EXISTS room_extra_items_select_own ON public.room_extra_items;
DROP POLICY IF EXISTS room_extra_items_insert_own ON public.room_extra_items;
DROP POLICY IF EXISTS room_extra_items_update_own ON public.room_extra_items;
DROP POLICY IF EXISTS room_extra_items_delete_own ON public.room_extra_items;

DROP POLICY IF EXISTS room_item_counts_select_own ON public.room_item_counts;
DROP POLICY IF EXISTS room_item_counts_insert_own ON public.room_item_counts;
DROP POLICY IF EXISTS room_item_counts_update_own ON public.room_item_counts;
DROP POLICY IF EXISTS room_item_counts_delete_own ON public.room_item_counts;

DROP POLICY IF EXISTS rooms_select_own ON public.rooms;
DROP POLICY IF EXISTS rooms_insert_own ON public.rooms;
DROP POLICY IF EXISTS rooms_update_own ON public.rooms;
DROP POLICY IF EXISTS rooms_delete_own ON public.rooms;

CREATE POLICY template_items_public_all ON public.template_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY room_extra_items_public_all ON public.room_extra_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY room_item_counts_public_all ON public.room_item_counts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY rooms_public_all ON public.rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
