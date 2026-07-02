
-- Wipe existing role rows for these six accounts then re-seed with position + sub-roles.
WITH targets AS (
  SELECT id, lower(email) AS email FROM auth.users
  WHERE lower(email) IN (
    'fantasyallie@icloud.com',
    'beckiia@hotmail.co.uk',
    'mdrake3171@gmail.com',
    'ajdrake1502@gmail.com',
    'reception@themickleton.co.uk',
    'shannonmdavies@hotmail.com'
  )
)
DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM targets);

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role::public.app_role
FROM auth.users u
JOIN (VALUES
  ('fantasyallie@icloud.com', 'admin'),
  ('fantasyallie@icloud.com', 'reception'),
  ('fantasyallie@icloud.com', 'housekeeper'),
  ('beckiia@hotmail.co.uk', 'manager'),
  ('beckiia@hotmail.co.uk', 'housekeeper'),
  ('mdrake3171@gmail.com', 'manager'),
  ('mdrake3171@gmail.com', 'housekeeper'),
  ('ajdrake1502@gmail.com', 'manager'),
  ('ajdrake1502@gmail.com', 'housekeeper'),
  ('reception@themickleton.co.uk', 'user'),
  ('reception@themickleton.co.uk', 'reception'),
  ('shannonmdavies@hotmail.com', 'user'),
  ('shannonmdavies@hotmail.com', 'housekeeper')
) AS r(email, role) ON lower(u.email) = r.email
ON CONFLICT (user_id, role) DO NOTHING;
