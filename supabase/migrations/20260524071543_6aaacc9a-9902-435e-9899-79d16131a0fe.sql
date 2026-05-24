
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_user_id_idx ON public.items(user_id, created_at);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_own" ON public.items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "items_insert_own" ON public.items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "items_update_own" ON public.items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "items_delete_own" ON public.items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_number integer NOT NULL CHECK (room_number BETWEEN 1 AND 50),
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, room_number)
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select_own" ON public.rooms FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rooms_insert_own" ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rooms_update_own" ON public.rooms FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rooms_delete_own" ON public.rooms FOR DELETE TO authenticated USING (auth.uid() = user_id);
