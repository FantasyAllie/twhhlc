
CREATE TABLE public.room_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  value text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_features TO authenticated;
GRANT ALL ON public.room_features TO service_role;
ALTER TABLE public.room_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own room_features" ON public.room_features
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_room_features_updated_at BEFORE UPDATE ON public.room_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.room_feature_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  feature_id uuid NOT NULL REFERENCES public.room_features(id) ON DELETE CASCADE,
  room_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_id, room_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_feature_rooms TO authenticated;
GRANT ALL ON public.room_feature_rooms TO service_role;
ALTER TABLE public.room_feature_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own room_feature_rooms" ON public.room_feature_rooms
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
