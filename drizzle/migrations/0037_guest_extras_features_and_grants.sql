-- Room Checklist and Guest Extras become one list of room items, each with rules
-- for which rooms need it today:
--  * kind 'check' items are ticked as present (TV remote, fan); 'leave' items are
--    left for the guest in an amount by guest count (water, coffee pods).
--  * a rule fits a room when it has one of room_types (or none are named), one of
--    room_features (or none), none of except_features, one of flags (or none: the
--    room's Guest & Room Info flag keys, built-in or custom), and one of note_words
--    in its housekeeping note (or none). applies_to is arrival, stayover, both, or
--    any (every room, whatever its job). The fitting rule naming the most of these
--    wins, then the earliest.
ALTER TABLE public.guest_extras ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'leave' CHECK (kind IN ('leave','check'));
ALTER TABLE public.guest_extra_rules
 ADD COLUMN IF NOT EXISTS room_features uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS except_features uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS flags text[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS note_words text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.guest_extra_rules DROP CONSTRAINT IF EXISTS guest_extra_rules_applies_to_check;
ALTER TABLE public.guest_extra_rules ADD CONSTRAINT guest_extra_rules_applies_to_check CHECK (applies_to IN ('arrival','stayover','both','any'));

-- Each hotel's current room checklist (or the default one) becomes 'check' items
-- for every room, once.
INSERT INTO public.guest_extras (hotel_id, name, icon, kind, sort_order)
SELECT h.id, item.value, 'check-square', 'check', (item.ord - 1)::int
FROM public.hotels h
LEFT JOIN public.room_checklist_settings s ON s.hotel_id = h.id
CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(s.items, '["TV Remote","Fan","Water"]'::jsonb)) WITH ORDINALITY AS item(value, ord)
WHERE char_length(btrim(item.value)) BETWEEN 1 AND 80
  AND NOT EXISTS (SELECT 1 FROM public.guest_extras g WHERE g.hotel_id = h.id AND g.kind = 'check');
INSERT INTO public.guest_extra_rules (hotel_id, extra_id, applies_to, quantities)
SELECT g.hotel_id, g.id, 'any', '{1}'
FROM public.guest_extras g
WHERE g.kind = 'check' AND NOT EXISTS (SELECT 1 FROM public.guest_extra_rules r WHERE r.extra_id = g.id);

-- Supabase's default privileges gave anon (and authenticated) every right on the
-- new tables, including TRUNCATE, which row-level security doesn't gate.
-- Signed-in users keep only what 0035 meant to grant.
REVOKE ALL ON public.guest_extras, public.guest_extra_rules FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.guest_extras, public.guest_extra_rules FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_extras, public.guest_extra_rules TO authenticated;
GRANT ALL ON public.guest_extras, public.guest_extra_rules TO service_role;
