CREATE TABLE public.hotel_floors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id),
 name text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 80),
 cupboard_key text NOT NULL DEFAULT gen_random_uuid()::text,
 sort_order integer NOT NULL DEFAULT 0,
 UNIQUE(hotel_id,cupboard_key)
);
CREATE UNIQUE INDEX hotel_floors_unique_name ON public.hotel_floors(hotel_id,lower(btrim(name)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_floors TO authenticated;
GRANT ALL ON public.hotel_floors TO service_role;
ALTER TABLE public.hotel_floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read hotel floors" ON public.hotel_floors FOR SELECT TO authenticated USING(private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));
CREATE POLICY "Manage hotel floors" ON public.hotel_floors FOR ALL TO authenticated USING(private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'developer') OR private.has_role(auth.uid(),'regional_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'manager'))) WITH CHECK(private.can_access_hotel(hotel_id) AND (private.has_role(auth.uid(),'developer') OR private.has_role(auth.uid(),'regional_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'manager')));
INSERT INTO public.hotel_floors(hotel_id,name,cupboard_key,sort_order)
SELECT h.id,v.name,v.key,v.ord FROM public.hotels h CROSS JOIN (VALUES ('Ground Floor','ground',0),('20''s','20s',1),('30''s','30s',2),('40''s','40s',3),('Laundry','laundry',4)) v(name,key,ord);
INSERT INTO public.hotel_floors(hotel_id,name,sort_order)
SELECT DISTINCT r.hotel_id,btrim(r.floor),5 FROM public.rooms r WHERE nullif(btrim(r.floor),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hotel_floors f WHERE f.hotel_id=r.hotel_id AND lower(f.name)=lower(btrim(r.floor)));
INSERT INTO public.hotel_floors(hotel_id,name,cupboard_key,sort_order)
SELECT DISTINCT c.hotel_id,c.location,c.location,6 FROM public.inventory_counts c WHERE c.section='cupboard' AND NOT EXISTS(SELECT 1 FROM public.hotel_floors f WHERE f.hotel_id=c.hotel_id AND f.cupboard_key=c.location) ON CONFLICT DO NOTHING;
CREATE FUNCTION public.sync_floor_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.hotel_id IS DISTINCT FROM OLD.hotel_id OR NEW.cupboard_key IS DISTINCT FROM OLD.cupboard_key THEN RAISE EXCEPTION 'Floor identity cannot change'; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN UPDATE public.rooms SET floor=NEW.name WHERE hotel_id=OLD.hotel_id AND floor=OLD.name; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.inventory_counts WHERE hotel_id=OLD.hotel_id AND section='cupboard' AND location=OLD.cupboard_key AND count>0) THEN RAISE EXCEPTION 'Reset this cupboard before removing it'; END IF;
  UPDATE public.rooms SET floor=NULL WHERE hotel_id=OLD.hotel_id AND floor=OLD.name;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_floor_name BEFORE UPDATE OR DELETE ON public.hotel_floors FOR EACH ROW EXECUTE FUNCTION public.sync_floor_name();
CREATE FUNCTION public.assign_floor_rooms(p_floor uuid,p_rooms integer[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.hotel_floors;
BEGIN
 SELECT * INTO f FROM public.hotel_floors WHERE id=p_floor FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) OR NOT private.can_access_hotel(f.hotel_id) OR NOT (private.has_role(auth.uid(),'developer') OR private.has_role(auth.uid(),'regional_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 IF p_rooms IS NULL THEN RAISE EXCEPTION 'Room selection required'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_rooms) n WHERE NOT EXISTS(SELECT 1 FROM public.rooms r WHERE r.hotel_id=f.hotel_id AND r.room_number=n)) THEN RAISE EXCEPTION 'Room no longer available'; END IF;
 UPDATE public.rooms SET floor=CASE WHEN room_number=ANY(p_rooms) THEN f.name ELSE NULL END WHERE hotel_id=f.hotel_id AND (floor=f.name OR room_number=ANY(p_rooms));
END $$;
REVOKE ALL ON FUNCTION public.assign_floor_rooms(uuid,integer[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_floor_rooms(uuid,integer[]) TO authenticated;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.daily_export_candidates(uuid,date)'::regprocedure) INTO definition;
 definition := replace(definition, 'CASE c.location WHEN ''ground'' THEN ''Ground Floor'' WHEN ''20s'' THEN ''20''''s'' WHEN ''30s'' THEN ''30''''s'' WHEN ''40s'' THEN ''40''''s'' WHEN ''laundry'' THEN ''Laundry'' ELSE c.location END', 'coalesce((SELECT f.name FROM public.hotel_floors f WHERE f.hotel_id=c.hotel_id AND f.cupboard_key=c.location),c.location)');
 EXECUTE definition;
END $$;