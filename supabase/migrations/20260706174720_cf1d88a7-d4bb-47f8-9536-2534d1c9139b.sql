ALTER TABLE public.room_messages DROP CONSTRAINT IF EXISTS room_messages_thread_check;
ALTER TABLE public.room_messages ADD CONSTRAINT room_messages_thread_check
  CHECK (thread = ANY (ARRAY['hk_reception'::text, 'hk_fnb'::text, 'reception_fnb'::text, 'hk_maintenance'::text, 'reception_maintenance'::text, 'fnb_maintenance'::text]));