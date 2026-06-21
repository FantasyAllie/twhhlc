DROP POLICY IF EXISTS "Users manage own reception_items" ON public.reception_items;
CREATE POLICY "reception_items_public_all" ON public.reception_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own room_features" ON public.room_features;
CREATE POLICY "room_features_public_all" ON public.room_features FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own room_feature_rooms" ON public.room_feature_rooms;
CREATE POLICY "room_feature_rooms_public_all" ON public.room_feature_rooms FOR ALL USING (true) WITH CHECK (true);