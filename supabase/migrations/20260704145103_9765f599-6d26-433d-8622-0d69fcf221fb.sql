
ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS thread text NOT NULL DEFAULT 'hk_reception',
  ADD COLUMN IF NOT EXISTS done_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.room_messages
  ADD CONSTRAINT room_messages_thread_check
  CHECK (thread IN ('hk_reception', 'hk_fnb', 'reception_fnb'));

ALTER TABLE public.room_messages ALTER COLUMN room_number DROP NOT NULL;

UPDATE public.room_messages
  SET done_at = COALESCE(updated_at, created_at)
  WHERE dismissed = true AND done_at IS NULL;

CREATE INDEX IF NOT EXISTS room_messages_thread_created_idx
  ON public.room_messages (thread, created_at DESC);
CREATE INDEX IF NOT EXISTS room_messages_room_number_idx
  ON public.room_messages (room_number)
  WHERE room_number IS NOT NULL;
