DROP POLICY IF EXISTS "Users can manage their own room types" ON public.room_types;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_types TO anon;
CREATE POLICY room_types_public_all ON public.room_types FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);