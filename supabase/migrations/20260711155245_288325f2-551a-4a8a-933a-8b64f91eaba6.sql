CREATE TABLE public.stayover_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number INTEGER NOT NULL,
  path TEXT NOT NULL,
  created_by_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stayover_photos TO authenticated;
GRANT ALL ON public.stayover_photos TO service_role;

ALTER TABLE public.stayover_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stayover photos"
  ON public.stayover_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can add stayover photos"
  ON public.stayover_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete stayover photos"
  ON public.stayover_photos FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX idx_stayover_photos_room_created ON public.stayover_photos (room_number, created_at DESC);