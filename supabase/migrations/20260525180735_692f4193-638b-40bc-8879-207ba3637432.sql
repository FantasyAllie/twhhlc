
-- Drop old items table (replaced by per-room model)
DROP TABLE IF EXISTS public.items;

-- Shared per-user master list of items
CREATE TABLE public.template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_items_select_own ON public.template_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY template_items_insert_own ON public.template_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY template_items_update_own ON public.template_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY template_items_delete_own ON public.template_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Extras attached to a specific room
CREATE TABLE public.room_extra_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_number int NOT NULL CHECK (room_number BETWEEN 1 AND 50),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.room_extra_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_extra_items_select_own ON public.room_extra_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY room_extra_items_insert_own ON public.room_extra_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY room_extra_items_update_own ON public.room_extra_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY room_extra_items_delete_own ON public.room_extra_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Per-(room, item) counts. item_kind distinguishes template vs extra; item_id is the uuid of that row.
CREATE TABLE public.room_item_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_number int NOT NULL CHECK (room_number BETWEEN 1 AND 50),
  item_kind text NOT NULL CHECK (item_kind IN ('template', 'extra')),
  item_id uuid NOT NULL,
  count int NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, room_number, item_kind, item_id)
);
ALTER TABLE public.room_item_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_item_counts_select_own ON public.room_item_counts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY room_item_counts_insert_own ON public.room_item_counts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY room_item_counts_update_own ON public.room_item_counts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY room_item_counts_delete_own ON public.room_item_counts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cascade deletes: when a template item or room extra is removed, drop its count rows.
-- (Using triggers because item_id can reference one of two tables.)
CREATE OR REPLACE FUNCTION public.delete_counts_for_template_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.room_item_counts WHERE user_id = OLD.user_id AND item_kind = 'template' AND item_id = OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_delete_counts_for_template_item
  BEFORE DELETE ON public.template_items
  FOR EACH ROW EXECUTE FUNCTION public.delete_counts_for_template_item();

CREATE OR REPLACE FUNCTION public.delete_counts_for_extra_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.room_item_counts WHERE user_id = OLD.user_id AND item_kind = 'extra' AND item_id = OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_delete_counts_for_extra_item
  BEFORE DELETE ON public.room_extra_items
  FOR EACH ROW EXECUTE FUNCTION public.delete_counts_for_extra_item();
