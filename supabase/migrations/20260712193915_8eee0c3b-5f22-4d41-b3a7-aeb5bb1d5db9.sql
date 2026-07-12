-- Rebase uniqueness constraints so the same creator can reuse values across hotel workspaces.
-- Each replacement adds hotel_id to the unique key.

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_user_id_room_number_key,
  ADD CONSTRAINT rooms_user_hotel_room_number_key UNIQUE (user_id, hotel_id, room_number);

ALTER TABLE public.room_types
  DROP CONSTRAINT IF EXISTS room_types_user_id_value_key,
  ADD CONSTRAINT room_types_user_hotel_value_key UNIQUE (user_id, hotel_id, value);

ALTER TABLE public.room_features
  DROP CONSTRAINT IF EXISTS room_features_user_id_value_key,
  ADD CONSTRAINT room_features_user_hotel_value_key UNIQUE (user_id, hotel_id, value);

ALTER TABLE public.room_feature_rooms
  DROP CONSTRAINT IF EXISTS room_feature_rooms_user_id_feature_id_room_number_key,
  ADD CONSTRAINT room_feature_rooms_user_hotel_feature_room_key UNIQUE (user_id, hotel_id, feature_id, room_number);

ALTER TABLE public.template_item_rooms
  DROP CONSTRAINT IF EXISTS template_item_rooms_user_id_template_item_id_room_number_key,
  ADD CONSTRAINT template_item_rooms_user_hotel_item_room_key UNIQUE (user_id, hotel_id, template_item_id, room_number);

ALTER TABLE public.reception_items
  DROP CONSTRAINT IF EXISTS reception_items_user_id_kind_label_key,
  ADD CONSTRAINT reception_items_user_hotel_kind_label_key UNIQUE (user_id, hotel_id, kind, label);

ALTER TABLE public.reject_counts
  DROP CONSTRAINT IF EXISTS reject_counts_user_id_template_item_id_key,
  ADD CONSTRAINT reject_counts_user_hotel_template_item_key UNIQUE (user_id, hotel_id, template_item_id);

ALTER TABLE public.room_item_counts
  DROP CONSTRAINT IF EXISTS room_item_counts_user_id_room_number_item_kind_item_id_key,
  ADD CONSTRAINT room_item_counts_user_hotel_room_item_key UNIQUE (user_id, hotel_id, room_number, item_kind, item_id);
