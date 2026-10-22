CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE INDEX IF NOT EXISTS export_snapshots_hotel_kind_created_idx ON public.export_snapshots(hotel_id, kind, created_at DESC);

CREATE OR REPLACE FUNCTION public.daily_export_candidates(p_hotel uuid, p_day date)
RETURNS TABLE(kind text, totals jsonb, grand_total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
WITH linen_names AS (
  SELECT c.count, btrim(CASE WHEN c.item_kind = 'template' THEN t.name ELSE e.name END) AS name
  FROM public.room_item_counts c
  LEFT JOIN public.template_items t ON c.item_kind = 'template' AND t.id = c.item_id AND t.hotel_id = p_hotel AND t.list_type = 'housekeeping'
  LEFT JOIN public.room_extra_items e ON c.item_kind <> 'template' AND e.id = c.item_id AND e.hotel_id = p_hotel
  WHERE c.hotel_id = p_hotel AND c.count > 0
), linen AS (
  SELECT name, sum(count)::integer AS count FROM linen_names WHERE name IS NOT NULL AND name <> '' GROUP BY name
), counter_rows AS (
  SELECT 'totals'::text AS kind, name, count FROM linen
  UNION ALL
  SELECT 'fnb_totals', btrim(t.name), c.count FROM public.fnb_linen_counts c JOIN public.template_items t ON t.id = c.template_item_id AND t.hotel_id = p_hotel AND t.list_type = 'fnb' WHERE c.hotel_id = p_hotel AND c.count > 0
  UNION ALL
  SELECT 'delivery', btrim(t.name), sum(c.count)::integer FROM public.delivery_counts c JOIN public.template_items t ON t.id = c.template_item_id AND t.hotel_id = p_hotel AND t.list_type = 'housekeeping' WHERE c.hotel_id = p_hotel AND c.count > 0 AND btrim(t.name) <> '' GROUP BY btrim(t.name)
  UNION ALL
  SELECT CASE c.section WHEN 'room' THEN 'inventory_rooms' ELSE 'inventory_cupboards' END,
    (CASE WHEN c.section = 'room' THEN 'Room ' || c.location ELSE CASE c.location WHEN 'ground' THEN 'Ground Floor' WHEN '20s' THEN '20''s' WHEN '30s' THEN '30''s' WHEN '40s' THEN '40''s' WHEN 'laundry' THEN 'Laundry' ELSE c.location END END) || ' — ' || t.name, c.count
  FROM public.inventory_counts c JOIN public.template_items t ON t.id = c.template_item_id AND t.hotel_id = p_hotel AND t.list_type = 'housekeeping'
  WHERE c.hotel_id = p_hotel AND c.section IN ('room', 'cupboard') AND c.count > 0
), counter_exports AS (
  SELECT kind, jsonb_agg(jsonb_build_object('name',name,'count',count) ORDER BY lower(name),name,count) AS totals, sum(count)::integer AS grand_total FROM counter_rows GROUP BY kind
), other_exports AS (
  SELECT 'room_status'::text AS kind,
    jsonb_agg(jsonb_build_object('room',r.room_number,'status',CASE WHEN s.label = 'DND' THEN 'Stayover' WHEN lower(s.label) = 'staff' THEN 'ROS - Staff' WHEN lower(s.label) = 'dirty' THEN 'ROS - Dirty' ELSE coalesce(s.label,'') END,'bed',coalesce(b.label,''),'maintenance',r.needs_maintenance) ORDER BY r.room_number) AS totals,
    count(*)::integer AS grand_total
  FROM public.rooms r
  LEFT JOIN public.reception_items s ON s.id::text = coalesce(r.reception_status_id::text,r.default_status) AND s.hotel_id = p_hotel
  LEFT JOIN public.reception_items b ON b.id = r.reception_bed_id AND b.hotel_id = p_hotel
  WHERE r.hotel_id = p_hotel HAVING count(*) > 0
  UNION ALL
  SELECT 'maintenance', jsonb_agg(jsonb_build_object('room',room_number,'note',btrim(coalesce(housekeeping_note,''))) ORDER BY room_number), count(*)::integer
  FROM public.rooms WHERE hotel_id = p_hotel AND needs_maintenance HAVING count(*) > 0
  UNION ALL
  SELECT 'checklists', jsonb_agg(jsonb_build_object('room',room_number,'department',department,'items',items,'by',completed_by_name,'at',completed_at) ORDER BY room_number,completed_at), count(*)::integer
  FROM public.room_checklist_completions WHERE hotel_id = p_hotel AND (completed_at AT TIME ZONE 'Europe/London')::date = p_day HAVING count(*) > 0
), previous_counters AS (
  SELECT DISTINCT ON (kind) kind, totals FROM public.export_snapshots
  WHERE hotel_id = p_hotel AND (created_at AT TIME ZONE 'Europe/London')::date < p_day
  ORDER BY kind, created_at DESC
)
SELECT c.kind, c.totals, c.grand_total FROM counter_exports c
LEFT JOIN previous_counters p ON p.kind = c.kind
WHERE p.kind IS NULL OR c.totals IS DISTINCT FROM (
  SELECT jsonb_agg(v ORDER BY lower(v->>'name'),v->>'name',(v->>'count')::integer) FROM jsonb_array_elements(p.totals) v
)
UNION ALL SELECT kind,totals,grand_total FROM other_exports;
$$;
REVOKE ALL ON FUNCTION public.daily_export_candidates(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_export_candidates(uuid,date) TO service_role;

CREATE OR REPLACE FUNCTION public.save_missing_nightly_exports(p_now timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE saved integer := 0; today date := (p_now AT TIME ZONE 'Europe/London')::date;
BEGIN
  -- One UTC schedule checks both possible UK 11pm hours; only the matching hour writes.
  IF extract(hour FROM p_now AT TIME ZONE 'Europe/London') <> 23 THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nightly-missing-exports',0));
  INSERT INTO public.export_snapshots(hotel_id,kind,totals,grand_total,created_at)
  SELECT h.id,c.kind,c.totals,c.grand_total,p_now FROM public.hotels h
  CROSS JOIN LATERAL public.daily_export_candidates(h.id,today) c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.export_snapshots s WHERE s.hotel_id = h.id AND s.kind = c.kind
      AND s.created_at >= (today::timestamp AT TIME ZONE 'Europe/London')
      AND s.created_at < ((today + 1)::timestamp AT TIME ZONE 'Europe/London')
  );
  GET DIAGNOSTICS saved = ROW_COUNT;
  RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION public.save_missing_nightly_exports(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_missing_nightly_exports(timestamptz) TO service_role;
COMMENT ON FUNCTION public.save_missing_nightly_exports(timestamptz) IS '11pm UK-time fallback: preserve existing same-day report kinds, omit unchanged counters, and run independently of open devices. Invoked by pg_cron.';