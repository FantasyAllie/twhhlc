-- Auto-default hotel_id on every tenant table to the caller's current hotel.
-- This lets existing app inserts compile without explicitly passing hotel_id.
do $$
declare
  t text;
  tables text[] := array[
    'rooms','room_types','room_features','room_feature_rooms',
    'template_items','template_item_rooms','room_extra_items',
    'room_item_counts','reject_counts','room_messages','lost_property',
    'maintenance_requests','reception_items','fnb_linen_counts',
    'stayover_photos','export_snapshots'
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table public.%I alter column hotel_id set default private.current_hotel_id()',
      t
    );
  end loop;
end $$;