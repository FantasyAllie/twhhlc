
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_number_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_number_check CHECK (room_number BETWEEN 1 AND 999);

ALTER TABLE public.template_item_rooms DROP CONSTRAINT IF EXISTS template_item_rooms_room_number_check;
ALTER TABLE public.template_item_rooms ADD CONSTRAINT template_item_rooms_room_number_check CHECK (room_number BETWEEN 1 AND 999);

ALTER TABLE public.room_item_counts DROP CONSTRAINT IF EXISTS room_item_counts_room_number_check;
ALTER TABLE public.room_item_counts ADD CONSTRAINT room_item_counts_room_number_check CHECK (room_number BETWEEN 1 AND 999);
