ALTER TABLE public.export_snapshots
ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'totals';