CREATE TABLE public.export_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  totals jsonb NOT NULL,
  grand_total integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_snapshots TO anon, authenticated;
GRANT ALL ON public.export_snapshots TO service_role;

ALTER TABLE public.export_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY export_snapshots_public_all ON public.export_snapshots
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_export_snapshots_created_at ON public.export_snapshots(created_at DESC);