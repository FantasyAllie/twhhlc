CREATE TABLE public.room_flag_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'flag',
  color text NOT NULL DEFAULT 'slate',
  hidden boolean NOT NULL DEFAULT false,
  is_custom boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_flag_settings TO authenticated;
GRANT ALL ON public.room_flag_settings TO service_role;
ALTER TABLE public.room_flag_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read flag settings" ON public.room_flag_settings FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "Admins and managers manage flag settings" ON public.room_flag_settings FOR ALL TO authenticated
  USING (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'regional_admin') OR private.has_role(auth.uid(),'developer')))
  WITH CHECK (private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'regional_admin') OR private.has_role(auth.uid(),'developer')));

CREATE TABLE public.room_custom_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_number integer NOT NULL,
  flag_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, room_number, flag_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_custom_flags TO authenticated;
GRANT ALL ON public.room_custom_flags TO service_role;
ALTER TABLE public.room_custom_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON public.room_custom_flags FOR ALL TO authenticated
  USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))
  WITH CHECK (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_custom_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_flag_settings;