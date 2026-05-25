
CREATE TABLE public.template_item_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  template_item_id uuid NOT NULL,
  room_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_item_id, room_number)
);

ALTER TABLE public.template_item_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_item_rooms_public_all"
ON public.template_item_rooms
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Clean up assignments when a template item is deleted
CREATE OR REPLACE FUNCTION public.delete_room_assignments_for_template_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.template_item_rooms
    WHERE user_id = OLD.user_id AND template_item_id = OLD.id;
  RETURN OLD;
END $$;

CREATE TRIGGER trg_delete_room_assignments_for_template_item
BEFORE DELETE ON public.template_items
FOR EACH ROW EXECUTE FUNCTION public.delete_room_assignments_for_template_item();

-- Backfill: assign each existing template item to all rooms that match its category
INSERT INTO public.template_item_rooms (user_id, template_item_id, room_number)
SELECT t.user_id, t.id, r.room_number
FROM public.template_items t
JOIN public.rooms r ON r.user_id = t.user_id AND r.category = t.category
ON CONFLICT DO NOTHING;
