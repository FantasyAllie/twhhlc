CREATE TABLE public.room_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  room_number integer NOT NULL,
  message text NOT NULL,
  created_by_username text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_messages TO anon, authenticated;
GRANT ALL ON public.room_messages TO service_role;

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_messages_public_all" ON public.room_messages
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX room_messages_room_active_idx ON public.room_messages (room_number) WHERE dismissed = false;

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;