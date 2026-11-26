CREATE TABLE public.hotel_screen_settings (
  hotel_id uuid PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  welcome text NOT NULL DEFAULT '',
  logo_path text,
  photo_path text,
  postcode text,
  latitude double precision,
  longitude double precision,
  road_radius_miles integer NOT NULL DEFAULT 10,
  bus_stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  rail_station text,
  bus_timetable jsonb NOT NULL DEFAULT '[]'::jsonb,
  trains jsonb NOT NULL DEFAULT '[]'::jsonb,
  taxis jsonb NOT NULL DEFAULT '[]'::jsonb,
  info_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  notices jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_screen_settings TO authenticated;
GRANT ALL ON public.hotel_screen_settings TO service_role;
REVOKE ALL ON public.hotel_screen_settings FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.hotel_screen_settings FROM authenticated;

ALTER TABLE public.hotel_screen_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel staff can read screen settings"
ON public.hotel_screen_settings
FOR SELECT
TO authenticated
USING (private.can_access_hotel(hotel_id));

CREATE POLICY "Admins and managers can add screen settings"
ON public.hotel_screen_settings
FOR INSERT
TO authenticated
WITH CHECK (
  private.can_access_hotel(hotel_id)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = public.hotel_screen_settings.hotel_id)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
);

CREATE POLICY "Admins and managers can update screen settings"
ON public.hotel_screen_settings
FOR UPDATE
TO authenticated
USING (
  private.can_access_hotel(hotel_id)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = public.hotel_screen_settings.hotel_id)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
)
WITH CHECK (
  private.can_access_hotel(hotel_id)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = public.hotel_screen_settings.hotel_id)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
);

CREATE POLICY "Admins and managers can delete screen settings"
ON public.hotel_screen_settings
FOR DELETE
TO authenticated
USING (
  private.can_access_hotel(hotel_id)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = public.hotel_screen_settings.hotel_id)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
);

CREATE OR REPLACE FUNCTION private.touch_hotel_screen_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END
$function$;

CREATE TRIGGER set_hotel_screen_settings_editor
BEFORE UPDATE ON public.hotel_screen_settings
FOR EACH ROW
EXECUTE FUNCTION private.touch_hotel_screen_settings();

CREATE TRIGGER developer_test_hotels_only
BEFORE INSERT OR UPDATE OR DELETE ON public.hotel_screen_settings
FOR EACH ROW
EXECUTE FUNCTION private.guard_developer_test_hotels();

CREATE POLICY "hotel branding insert admins"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hotel-branding'
  AND private.can_access_hotel(((storage.foldername(name))[1])::uuid)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = ((storage.foldername(name))[1])::uuid)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
);

CREATE POLICY "hotel branding update admins"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hotel-branding'
  AND private.can_access_hotel(((storage.foldername(name))[1])::uuid)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = ((storage.foldername(name))[1])::uuid)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
)
WITH CHECK (
  bucket_id = 'hotel-branding'
  AND private.can_access_hotel(((storage.foldername(name))[1])::uuid)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = ((storage.foldername(name))[1])::uuid)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
);

CREATE POLICY "hotel branding delete admins"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'hotel-branding'
  AND private.can_access_hotel(((storage.foldername(name))[1])::uuid)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR ((SELECT h.developer_only FROM public.hotels h WHERE h.id = ((storage.foldername(name))[1])::uuid)
        AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
);