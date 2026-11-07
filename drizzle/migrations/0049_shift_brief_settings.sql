-- Today's brief: which tiles each hotel shows. Managers and admins choose in
-- Hotel settings. Hidden items are listed, so anything new shows by default.
-- Keys: job:departure, job:turnover, job:arrival, job:stayover, job:guests,
-- flag:<room flag key>, extra:<guest_extras id>.
CREATE TABLE public.shift_brief_settings (
 hotel_id uuid PRIMARY KEY DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 hidden text[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shift_brief_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shift_brief_settings FROM anon;
REVOKE ALL ON public.shift_brief_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shift_brief_settings TO authenticated;
GRANT ALL ON public.shift_brief_settings TO service_role;
CREATE POLICY "Read shift_brief_settings" ON public.shift_brief_settings FOR SELECT TO authenticated
 USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "Add shift_brief_settings" ON public.shift_brief_settings FOR INSERT TO authenticated
 WITH CHECK (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()));
CREATE POLICY "Change shift_brief_settings" ON public.shift_brief_settings FOR UPDATE TO authenticated
 USING (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()))
 WITH CHECK (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()));
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='shift_brief_settings') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_brief_settings;
 END IF;
END $$;
