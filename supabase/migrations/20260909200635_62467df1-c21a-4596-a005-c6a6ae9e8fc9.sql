CREATE OR REPLACE FUNCTION public.trim_ops_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ops_snapshots o
  WHERE o.hotel_id = NEW.hotel_id
    AND o.id NOT IN (
      SELECT id FROM public.ops_snapshots
      WHERE hotel_id = NEW.hotel_id
      ORDER BY created_at DESC
      LIMIT 5
    );
  RETURN NULL;
END $$;