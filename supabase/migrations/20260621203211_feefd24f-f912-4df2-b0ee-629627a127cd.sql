CREATE TABLE public.reception_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('status','bed')),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reception_items TO authenticated;
GRANT ALL ON public.reception_items TO service_role;
ALTER TABLE public.reception_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reception_items" ON public.reception_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_reception_items_updated_at BEFORE UPDATE ON public.reception_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();