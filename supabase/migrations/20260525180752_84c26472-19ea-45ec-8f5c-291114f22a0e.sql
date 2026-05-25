
CREATE OR REPLACE FUNCTION public.delete_counts_for_template_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  DELETE FROM public.room_item_counts WHERE user_id = OLD.user_id AND item_kind = 'template' AND item_id = OLD.id;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.delete_counts_for_extra_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  DELETE FROM public.room_item_counts WHERE user_id = OLD.user_id AND item_kind = 'extra' AND item_id = OLD.id;
  RETURN OLD;
END $$;
