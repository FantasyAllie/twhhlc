-- Add F&B sub-role and shared linen counter
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fnb';

-- Update is_approved to include fnb (private schema helper)
CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'user', 'reception', 'housekeeper', 'fnb')
  )
$$;

-- Shared global F&B linen counter (single row per template item)
CREATE TABLE IF NOT EXISTS public.fnb_linen_counts (
  template_item_id uuid PRIMARY KEY REFERENCES public.template_items(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fnb_linen_counts TO authenticated;
GRANT ALL ON public.fnb_linen_counts TO service_role;

ALTER TABLE public.fnb_linen_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read F&B counts"
  ON public.fnb_linen_counts FOR SELECT
  TO authenticated
  USING (private.is_approved(auth.uid()));

CREATE POLICY "Approved users can insert F&B counts"
  ON public.fnb_linen_counts FOR INSERT
  TO authenticated
  WITH CHECK (private.is_approved(auth.uid()));

CREATE POLICY "Approved users can update F&B counts"
  ON public.fnb_linen_counts FOR UPDATE
  TO authenticated
  USING (private.is_approved(auth.uid()))
  WITH CHECK (private.is_approved(auth.uid()));

CREATE POLICY "Admins/managers can delete F&B counts"
  ON public.fnb_linen_counts FOR DELETE
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'manager')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.fnb_linen_counts;