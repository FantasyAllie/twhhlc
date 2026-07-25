DROP POLICY IF EXISTS "Regional admins manage memberships" ON public.hotel_members;
CREATE POLICY "Regional admins and developers manage memberships"
ON public.hotel_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text IN ('regional_admin','developer')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text IN ('regional_admin','developer')));

INSERT INTO public.user_roles (user_id, role)
VALUES ('a6f0ec03-4a97-40c5-8ee2-70b7d03fd446', 'developer')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id = 'a6f0ec03-4a97-40c5-8ee2-70b7d03fd446' AND role = 'admin';