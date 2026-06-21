INSERT INTO public.room_types (user_id, value, label)
SELECT id, 'double', 'Double' FROM auth.users
UNION ALL
SELECT id, 'super_king', 'Super King' FROM auth.users
ON CONFLICT (user_id, value) DO NOTHING;