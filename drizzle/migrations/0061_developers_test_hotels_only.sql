-- Developer accounts are for test hotels. On a developer-only hotel (see 0021) a
-- developer can change anything; on every other hotel they can look but not
-- change anything. Admins, regional admins and managers keep exactly the rights
-- they had.

-- 1. Hotel settings (flip interval, delivery days, …). The old rule left
--    developers out entirely; now they may change test hotels only.
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
    OR (developer_only AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
)
WITH CHECK (
  private.can_access_hotel(id)
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'regional_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'manager'::public.app_role)
    OR (developer_only AND private.has_role(auth.uid(), 'developer'::public.app_role))
  )
);

-- 2. True when the hotel exists and is a real (not developer-only) hotel.
CREATE OR REPLACE FUNCTION private.is_live_hotel(_hotel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotels WHERE id = _hotel_id AND NOT developer_only);
$$;
REVOKE ALL ON FUNCTION private.is_live_hotel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_live_hotel(uuid) TO authenticated, service_role;

-- 3. One guard on every hotel table. A trigger (rather than more policies) also
--    covers database functions that write with elevated rights. It only acts on
--    signed-in developer accounts; server jobs (no auth.uid()) are unaffected.
CREATE OR REPLACE FUNCTION private.guard_developer_test_hotels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  blocked boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'developer'::public.app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_TABLE_NAME = 'hotels' THEN
    -- A developer may only create, change or delete developer-only hotels, and
    -- can't turn a test hotel into a real one or the other way round.
    IF TG_OP IN ('UPDATE', 'DELETE') AND NOT OLD.developer_only THEN blocked := true; END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND NOT NEW.developer_only THEN blocked := true; END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') AND private.is_live_hotel(OLD.hotel_id) THEN blocked := true; END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND private.is_live_hotel(NEW.hotel_id) THEN blocked := true; END IF;
  END IF;
  IF blocked THEN
    RAISE EXCEPTION 'Developer accounts can only change test hotels' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION private.guard_developer_test_hotels() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS developer_test_hotels_only ON public.hotels;
CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.hotels
  FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels();

-- Every public table with a hotel_id, except user_active_hotel: switching to a
-- live hotel to look at it is allowed.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'hotel_id' AND tb.table_type = 'BASE TABLE'
      AND c.table_name <> 'user_active_hotel'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS developer_test_hotels_only ON public.%I', t);
    EXECUTE format('CREATE TRIGGER developer_test_hotels_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_developer_test_hotels()', t);
  END LOOP;
END $$;
