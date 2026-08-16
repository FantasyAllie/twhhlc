UPDATE public.rooms
SET done = false,
    updated_at = now()
WHERE hotel_id = 'b0d776f1-1ff2-429d-a1fe-e3557a233c48'
  AND room_number = 27
  AND done = true
  AND done_reception = false;