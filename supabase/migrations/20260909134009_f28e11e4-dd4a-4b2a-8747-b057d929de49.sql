CREATE TABLE public.ops_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('full','delta')),
  label text,
  payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_snapshots TO authenticated;
GRANT ALL ON public.ops_snapshots TO service_role;

ALTER TABLE public.ops_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access" ON public.ops_snapshots
FOR ALL TO authenticated
USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))
WITH CHECK (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id));

CREATE INDEX ops_snapshots_hotel_created_idx ON public.ops_snapshots (hotel_id, created_at DESC);

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
      LIMIT 60
    );
  RETURN NULL;
END $$;

CREATE TRIGGER trg_trim_ops_snapshots
AFTER INSERT ON public.ops_snapshots
FOR EACH ROW EXECUTE FUNCTION public.trim_ops_snapshots();