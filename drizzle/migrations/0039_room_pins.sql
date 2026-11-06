-- Room pins: a message pinned to a room for one department. A request needs Done,
-- a note needs Seen; either can be dismissed. Replies stay on the pin, so both
-- sides see one thread. Replaces reception's room messages in step 1 of the
-- messages redesign; the department group chats are unchanged for now.

-- The departments a user works in, as message keys.
CREATE OR REPLACE FUNCTION private.user_departments(_user_id uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(array_agg(d ORDER BY d), '{}') FROM (
  SELECT DISTINCT CASE role WHEN 'housekeeper' THEN 'housekeeping' WHEN 'reception' THEN 'reception' WHEN 'fnb' THEN 'fnb' WHEN 'maintenance' THEN 'maintenance' END AS d
  FROM public.user_roles WHERE user_id = _user_id AND role IN ('housekeeper','reception','fnb','maintenance')
 ) x;
$$;
REVOKE ALL ON FUNCTION private.user_departments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.user_departments(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin_or_manager(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager','regional_admin','developer'));
$$;
REVOKE ALL ON FUNCTION private.is_admin_or_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin_or_manager(uuid) TO authenticated, service_role;

CREATE TABLE public.room_pins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 room_number integer NOT NULL,
 to_department text NOT NULL CHECK (to_department IN ('housekeeping','reception','fnb','maintenance')),
 kind text NOT NULL DEFAULT 'request' CHECK (kind IN ('request','note')),
 message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','seen','dismissed')),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_by_name text NOT NULL DEFAULT 'Staff',
 created_by_departments text[] NOT NULL DEFAULT '{}',
 resolved_by_name text,
 resolved_at timestamptz,
 -- The last reply (or Done/Seen) from someone other than the sender, and when
 -- the sender last looked: a newer reply puts a badge on the sender's Home.
 last_reply_at timestamptz,
 sender_seen_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_pins_hotel_room ON public.room_pins(hotel_id, room_number, created_at);
CREATE INDEX room_pins_open ON public.room_pins(hotel_id, to_department) WHERE status = 'open';

CREATE TABLE public.room_pin_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 pin_id uuid NOT NULL REFERENCES public.room_pins(id) ON DELETE CASCADE,
 message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_by_name text NOT NULL DEFAULT 'Staff',
 created_by_departments text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_pin_replies_pin ON public.room_pin_replies(pin_id, created_at);

-- Each hotel's one-tap answers. A reply that resolves also marks the pin Done
-- (requests) or Seen (notes).
CREATE TABLE public.quick_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL DEFAULT private.current_hotel_id() REFERENCES public.hotels(id) ON DELETE CASCADE,
 label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
 applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('request','note','both')),
 resolves boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quick_replies_hotel ON public.quick_replies(hotel_id, sort_order);

-- Who wrote it, from the signed-in account, so nobody can post as someone else.
CREATE OR REPLACE FUNCTION public.assign_room_pin_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
  NEW.created_by := auth.uid();
  SELECT coalesce(nullif(display_name,''), nullif(split_part(email,'@',1),''), 'Staff') INTO NEW.created_by_name FROM public.profiles WHERE id = auth.uid();
  NEW.created_by_name := coalesce(NEW.created_by_name, 'Staff');
  NEW.created_by_departments := private.user_departments(auth.uid());
 END IF;
 NEW.created_at := now();
 IF TG_TABLE_NAME = 'room_pins' THEN
  NEW.status := 'open'; NEW.resolved_by_name := NULL; NEW.resolved_at := NULL;
  NEW.last_reply_at := NULL; NEW.sender_seen_at := now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_room_pin_identity BEFORE INSERT ON public.room_pins FOR EACH ROW EXECUTE FUNCTION public.assign_room_pin_identity();
CREATE TRIGGER trg_room_pin_reply_identity BEFORE INSERT ON public.room_pin_replies FOR EACH ROW EXECUTE FUNCTION public.assign_room_pin_identity();

-- A reply from someone else badges the sender; the sender's own reply counts as looking.
CREATE OR REPLACE FUNCTION public.note_room_pin_reply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.room_pins SET
  last_reply_at = CASE WHEN created_by <> NEW.created_by THEN NEW.created_at ELSE last_reply_at END,
  sender_seen_at = CASE WHEN created_by = NEW.created_by THEN NEW.created_at ELSE sender_seen_at END
 WHERE id = NEW.pin_id;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_room_pin_reply_note AFTER INSERT ON public.room_pin_replies FOR EACH ROW EXECUTE FUNCTION public.note_room_pin_reply();

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['room_pins','room_pin_replies','quick_replies'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('CREATE POLICY "Read %s" ON public.%I FOR SELECT TO authenticated USING (private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id))', t, t);
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END IF;
 END LOOP;
END $$;

-- Pins and replies are added directly; everything else goes through the functions below.
GRANT SELECT, INSERT ON public.room_pins, public.room_pin_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_replies TO authenticated;

CREATE POLICY "Add room pins" ON public.room_pins FOR INSERT TO authenticated WITH CHECK (
 private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id)
 AND EXISTS (SELECT 1 FROM public.rooms r WHERE r.hotel_id = room_pins.hotel_id AND r.room_number = room_pins.room_number));
CREATE POLICY "Reply to room pins" ON public.room_pin_replies FOR INSERT TO authenticated WITH CHECK (
 private.is_approved(auth.uid()) AND private.can_access_hotel(hotel_id)
 AND EXISTS (SELECT 1 FROM public.room_pins p WHERE p.id = room_pin_replies.pin_id AND p.hotel_id = room_pin_replies.hotel_id));
CREATE POLICY "Manage quick_replies" ON public.quick_replies FOR ALL TO authenticated
 USING (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()))
 WITH CHECK (private.can_access_hotel(hotel_id) AND private.is_admin_or_manager(auth.uid()));

-- Done (requests), Seen (notes) or Dismissed. The pin's department, managers and
-- admins can do any of them; the sender can dismiss their own pin.
CREATE OR REPLACE FUNCTION public.resolve_room_pin(p_pin uuid, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.room_pins; v_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_approved(auth.uid()) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 SELECT * INTO v FROM public.room_pins WHERE id = p_pin FOR UPDATE;
 IF NOT FOUND OR NOT private.can_access_hotel(v.hotel_id) THEN RAISE EXCEPTION 'This pin is no longer available'; END IF;
 IF v.status <> 'open' THEN RETURN; END IF;
 IF p_status NOT IN ('done','seen','dismissed')
   OR (p_status = 'done' AND v.kind <> 'request') OR (p_status = 'seen' AND v.kind <> 'note') THEN
  RAISE EXCEPTION 'That doesn''t apply to this pin';
 END IF;
 IF NOT (v.to_department = ANY(private.user_departments(auth.uid())) OR private.is_admin_or_manager(auth.uid())
   OR (p_status = 'dismissed' AND v.created_by = auth.uid())) THEN
  RAISE EXCEPTION 'Only % can do that', CASE v.to_department WHEN 'fnb' THEN 'F&B' ELSE initcap(v.to_department) END;
 END IF;
 SELECT coalesce(nullif(display_name,''), nullif(split_part(email,'@',1),''), 'Staff') INTO v_name FROM public.profiles WHERE id = auth.uid();
 UPDATE public.room_pins SET status = p_status, resolved_by_name = coalesce(v_name,'Staff'), resolved_at = now(),
  last_reply_at = CASE WHEN created_by <> auth.uid() THEN now() ELSE last_reply_at END,
  sender_seen_at = CASE WHEN created_by = auth.uid() THEN now() ELSE sender_seen_at END
 WHERE id = p_pin;
END $$;
REVOKE ALL ON FUNCTION public.resolve_room_pin(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_room_pin(uuid,text) TO authenticated, service_role;

-- The sender has looked at their pin's replies: clears the badge on their Home.
CREATE OR REPLACE FUNCTION public.mark_room_pin_seen(p_pin uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.room_pins SET sender_seen_at = now() WHERE id = p_pin AND created_by = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.mark_room_pin_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_room_pin_seen(uuid) TO authenticated, service_role;

-- Starting quick replies for every hotel, now and when one is added.
CREATE OR REPLACE FUNCTION public.seed_quick_replies(p_hotel uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 INSERT INTO public.quick_replies (hotel_id, label, applies_to, resolves, sort_order)
 SELECT p_hotel, q.label, q.applies_to, q.resolves, q.ord FROM (VALUES
  ('On it', 'request', false, 0), ('Done', 'request', true, 1), ('Can''t yet', 'request', false, 2),
  ('Guest still in', 'request', false, 3), ('Thanks', 'note', true, 4)
 ) AS q(label, applies_to, resolves, ord)
 WHERE NOT EXISTS (SELECT 1 FROM public.quick_replies WHERE hotel_id = p_hotel);
$$;
REVOKE ALL ON FUNCTION public.seed_quick_replies(uuid) FROM PUBLIC, anon, authenticated;
SELECT public.seed_quick_replies(id) FROM public.hotels;
CREATE OR REPLACE FUNCTION public.seed_hotel_quick_replies() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_quick_replies(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER trg_seed_quick_replies AFTER INSERT ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.seed_hotel_quick_replies();
