ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid NULL REFERENCES public.room_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_sender text NULL,
  ADD COLUMN IF NOT EXISTS reply_to_snippet text NULL;