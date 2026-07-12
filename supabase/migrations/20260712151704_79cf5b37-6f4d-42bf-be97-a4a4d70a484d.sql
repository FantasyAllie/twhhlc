
-- 1. user_roles: explicit admin-only write policies
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2. stayover_photos: require approval
DROP POLICY IF EXISTS "Authenticated can view stayover photos" ON public.stayover_photos;
DROP POLICY IF EXISTS "Authenticated can add stayover photos" ON public.stayover_photos;
DROP POLICY IF EXISTS "Authenticated can delete stayover photos" ON public.stayover_photos;

CREATE POLICY "Approved users can view stayover photos" ON public.stayover_photos
  FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()));

CREATE POLICY "Approved users can add stayover photos" ON public.stayover_photos
  FOR INSERT TO authenticated
  WITH CHECK (private.is_approved(auth.uid()));

CREATE POLICY "Approved users can delete stayover photos" ON public.stayover_photos
  FOR DELETE TO authenticated
  USING (private.is_approved(auth.uid()));

-- 3. entry-photos storage: require approval
DROP POLICY IF EXISTS "entry-photos authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "entry-photos authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "entry-photos authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "entry-photos authenticated delete" ON storage.objects;

CREATE POLICY "entry-photos approved read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'entry-photos' AND private.is_approved(auth.uid()));

CREATE POLICY "entry-photos approved insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'entry-photos' AND private.is_approved(auth.uid()));

CREATE POLICY "entry-photos approved update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'entry-photos' AND private.is_approved(auth.uid()))
  WITH CHECK (bucket_id = 'entry-photos' AND private.is_approved(auth.uid()));

CREATE POLICY "entry-photos approved delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'entry-photos' AND private.is_approved(auth.uid()));
