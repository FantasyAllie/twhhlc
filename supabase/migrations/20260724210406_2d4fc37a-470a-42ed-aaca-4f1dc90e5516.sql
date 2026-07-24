ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS linen_delivery_days smallint[] NOT NULL DEFAULT '{}'::smallint[];

ALTER TABLE public.hotels
  ADD CONSTRAINT hotels_linen_delivery_days_range
  CHECK (
    linen_delivery_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  );

DROP POLICY IF EXISTS "Admins and managers can update their hotel" ON public.hotels;
CREATE POLICY "Admins and managers can update their hotel"
ON public.hotels
FOR UPDATE
TO authenticated
USING (
  private.can_access_hotel(id)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
  )
)
WITH CHECK (
  private.can_access_hotel(id)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
  )
);