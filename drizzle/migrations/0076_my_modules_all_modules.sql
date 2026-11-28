CREATE OR REPLACE FUNCTION public.my_modules()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(hm.module ORDER BY hm.module), '{}')
  FROM public.hotel_modules hm
  WHERE hm.hotel_id = private.current_hotel_id()
    AND private.has_module(hm.hotel_id, hm.module);
$$;
REVOKE ALL ON FUNCTION public.my_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_modules() TO authenticated, service_role;