-- Developer-only test hotels: invisible and inaccessible to every non-developer account.
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS developer_only boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.can_access_hotel(_hotel_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = _hotel_id AND h.developer_only)
         AND NOT private.has_role(auth.uid(), 'developer'::public.app_role) THEN FALSE
    WHEN (SELECT hotel_id FROM public.user_active_hotel WHERE user_id = auth.uid()) IS NOT NULL
      THEN _hotel_id = (SELECT hotel_id FROM public.user_active_hotel WHERE user_id = auth.uid())
    WHEN private.is_regional_admin(auth.uid()) THEN TRUE
    ELSE FALSE
  END
$function$;

DROP POLICY IF EXISTS "Approved users can read hotels" ON public.hotels;
CREATE POLICY "Approved users can read hotels" ON public.hotels FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()) AND (NOT developer_only OR private.has_role(auth.uid(), 'developer'::public.app_role)));

-- Only developer accounts may ever be members of a developer-only hotel (blocks every assignment path).
CREATE OR REPLACE FUNCTION public.guard_developer_only_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hotels WHERE id = NEW.hotel_id AND developer_only)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'developer') THEN
    RAISE EXCEPTION 'Only developer accounts can join a test hotel';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hotel_members_developer_only BEFORE INSERT OR UPDATE ON public.hotel_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_developer_only_membership();
CREATE OR REPLACE FUNCTION public.guard_developer_only_active_hotel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hotels WHERE id = NEW.hotel_id AND developer_only)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'developer') THEN
    RAISE EXCEPTION 'Hotel not found';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_active_hotel_developer_only BEFORE INSERT OR UPDATE ON public.user_active_hotel
  FOR EACH ROW EXECUTE FUNCTION public.guard_developer_only_active_hotel();

-- Create the test copy of Three Ways House Hotel: settings, rooms and lists only (no history, counts, messages or users).
DO $$
DECLARE src uuid; dst uuid; dev uuid;
BEGIN
  SELECT id INTO src FROM public.hotels WHERE slug = 'three-ways-house';
  IF src IS NULL OR EXISTS (SELECT 1 FROM public.hotels WHERE slug = 'three-ways-house-test') THEN RETURN; END IF;
  dst := gen_random_uuid();
  INSERT INTO public.hotels (id, name, slug, timezone, linen_delivery_days, mattress_interval_months, developer_only)
    SELECT dst, 'Three Ways House Hotel (Test)', 'three-ways-house-test', timezone, linen_delivery_days, mattress_interval_months, true
    FROM public.hotels WHERE id = src;

  CREATE TEMP TABLE map_ri ON COMMIT DROP AS SELECT id AS old_id, gen_random_uuid() AS new_id FROM public.reception_items WHERE hotel_id = src;
  INSERT INTO public.reception_items (id, user_id, kind, label, sort_order, hotel_id)
    SELECT m.new_id, r.user_id, r.kind, r.label, r.sort_order, dst FROM public.reception_items r JOIN map_ri m ON m.old_id = r.id;

  INSERT INTO public.room_types (user_id, value, label, sort_order, hotel_id)
    SELECT user_id, value, label, sort_order, dst FROM public.room_types WHERE hotel_id = src;

  CREATE TEMP TABLE map_rf ON COMMIT DROP AS SELECT id AS old_id, gen_random_uuid() AS new_id FROM public.room_features WHERE hotel_id = src;
  INSERT INTO public.room_features (id, user_id, value, label, sort_order, hotel_id)
    SELECT m.new_id, f.user_id, f.value, f.label, f.sort_order, dst FROM public.room_features f JOIN map_rf m ON m.old_id = f.id;
  INSERT INTO public.room_feature_rooms (user_id, feature_id, room_number, hotel_id)
    SELECT x.user_id, m.new_id, x.room_number, dst FROM public.room_feature_rooms x JOIN map_rf m ON m.old_id = x.feature_id WHERE x.hotel_id = src;

  INSERT INTO public.room_flag_settings (hotel_id, key, label, icon, color, hidden, is_custom, sort_order, removed)
    SELECT dst, key, label, icon, color, hidden, is_custom, sort_order, removed FROM public.room_flag_settings WHERE hotel_id = src;
  INSERT INTO public.room_checklist_settings (hotel_id, items)
    SELECT dst, items FROM public.room_checklist_settings WHERE hotel_id = src;
  INSERT INTO public.maintenance_areas (hotel_id, user_id, label, sort_order)
    SELECT dst, user_id, label, sort_order FROM public.maintenance_areas WHERE hotel_id = src;

  CREATE TEMP TABLE map_ti ON COMMIT DROP AS SELECT id AS old_id, gen_random_uuid() AS new_id FROM public.template_items WHERE hotel_id = src;
  INSERT INTO public.template_items (id, user_id, name, category, position, default_count, color, list_type, hotel_id)
    SELECT m.new_id, t.user_id, t.name, t.category, t.position, t.default_count, t.color, t.list_type, dst FROM public.template_items t JOIN map_ti m ON m.old_id = t.id;
  INSERT INTO public.template_item_rooms (user_id, template_item_id, room_number, hotel_id)
    SELECT x.user_id, m.new_id, x.room_number, dst FROM public.template_item_rooms x JOIN map_ti m ON m.old_id = x.template_item_id WHERE x.hotel_id = src;
  INSERT INTO public.room_preferred_items (hotel_id, room_number, template_item_id)
    SELECT dst, x.room_number, m.new_id FROM public.room_preferred_items x JOIN map_ti m ON m.old_id = x.template_item_id WHERE x.hotel_id = src;
  INSERT INTO public.room_extra_items (user_id, room_number, name, hotel_id)
    SELECT user_id, room_number, name, dst FROM public.room_extra_items WHERE hotel_id = src;

  INSERT INTO public.rooms (user_id, room_number, sort_order, category, default_status, reception_status_id, reception_bed_id,
      reception_status_secondary_id, housekeeping_note, checked_items, mattress_tracking, mattress_interval_months, mattress_flipped_at, hotel_id)
    SELECT r.user_id, r.room_number, r.sort_order, r.category, r.default_status,
      (SELECT new_id FROM map_ri WHERE old_id = r.reception_status_id),
      (SELECT new_id FROM map_ri WHERE old_id = r.reception_bed_id),
      (SELECT new_id FROM map_ri WHERE old_id = r.reception_status_secondary_id),
      r.housekeeping_note, r.checked_items, r.mattress_tracking, r.mattress_interval_months, r.mattress_flipped_at, dst
    FROM public.rooms r WHERE r.hotel_id = src;

  FOR dev IN SELECT user_id FROM public.user_roles WHERE role = 'developer' LOOP
    INSERT INTO public.hotel_members (user_id, hotel_id) VALUES (dev, dst) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
