CREATE TABLE public.reject_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  template_item_id UUID NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reject_counts TO anon, authenticated;
GRANT ALL ON public.reject_counts TO service_role;

ALTER TABLE public.reject_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reject_counts_public_all" ON public.reject_counts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.delete_rejects_for_template_item()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.reject_counts WHERE user_id = OLD.user_id AND template_item_id = OLD.id;
  RETURN OLD;
END $$;

CREATE TRIGGER trg_delete_rejects_for_template_item
BEFORE DELETE ON public.template_items
FOR EACH ROW EXECUTE FUNCTION public.delete_rejects_for_template_item();