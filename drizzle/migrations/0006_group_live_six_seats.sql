CREATE TABLE public.group_live_rooms (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), host_id uuid NOT NULL, ended_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.group_live_rooms TO authenticated;
GRANT ALL ON public.group_live_rooms TO service_role;
ALTER TABLE public.group_live_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in browse group rooms" ON public.group_live_rooms FOR SELECT TO authenticated USING (true);
CREATE TABLE public.group_live_members (room_id uuid NOT NULL REFERENCES public.group_live_rooms(id) ON DELETE CASCADE, user_id uuid NOT NULL, seat integer NOT NULL CHECK (seat BETWEEN 1 AND 6), joined_at timestamptz NOT NULL DEFAULT now(), heartbeat_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_id,user_id), UNIQUE(room_id,seat));
GRANT SELECT ON public.group_live_members TO authenticated;
GRANT ALL ON public.group_live_members TO service_role;
ALTER TABLE public.group_live_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "browse group members" ON public.group_live_members FOR SELECT TO authenticated USING (true);
CREATE FUNCTION public.is_group_live_member(_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.group_live_members WHERE room_id=_room AND user_id=auth.uid() AND heartbeat_at > now()-interval '45 seconds') $$;
REVOKE ALL ON FUNCTION public.is_group_live_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_live_member(uuid) TO authenticated;
CREATE TABLE public.group_live_signals (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room_id uuid NOT NULL REFERENCES public.group_live_rooms(id) ON DELETE CASCADE, sender_id uuid NOT NULL, recipient_id uuid NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.group_live_signals TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.group_live_signals_id_seq TO authenticated;
GRANT ALL ON public.group_live_signals TO service_role;
GRANT ALL ON SEQUENCE public.group_live_signals_id_seq TO service_role;
ALTER TABLE public.group_live_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members send signals" ON public.group_live_signals FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND public.is_group_live_member(room_id) AND EXISTS(SELECT 1 FROM public.group_live_members WHERE room_id=group_live_signals.room_id AND user_id=recipient_id AND heartbeat_at > now()-interval '45 seconds'));
CREATE POLICY "recipient reads signals" ON public.group_live_signals FOR SELECT TO authenticated USING (recipient_id=auth.uid() AND public.is_group_live_member(room_id));
CREATE POLICY "recipient consumes signals" ON public.group_live_signals FOR DELETE TO authenticated USING (recipient_id=auth.uid());
CREATE INDEX group_live_signals_recipient ON public.group_live_signals(room_id,recipient_id,id);
CREATE FUNCTION public.join_group_live(_room uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); rid uuid := _room; available integer;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in to go live'; END IF;
 IF rid IS NULL THEN INSERT INTO public.group_live_rooms(host_id) VALUES(me) RETURNING id INTO rid; END IF;
 PERFORM 1 FROM public.group_live_rooms WHERE id=rid AND ended_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This live has ended'; END IF;
 DELETE FROM public.group_live_members WHERE room_id=rid AND heartbeat_at < now()-interval '45 seconds';
 IF EXISTS(SELECT 1 FROM public.group_live_members WHERE room_id=rid AND user_id=me) THEN UPDATE public.group_live_members SET heartbeat_at=now() WHERE room_id=rid AND user_id=me; RETURN rid; END IF;
 SELECT s INTO available FROM generate_series(1,6) s WHERE NOT EXISTS (SELECT 1 FROM public.group_live_members WHERE room_id=rid AND seat=s) ORDER BY s LIMIT 1;
 IF available IS NULL THEN RAISE EXCEPTION 'This live is full (6 people)'; END IF;
 INSERT INTO public.group_live_members(room_id,user_id,seat) VALUES(rid,me,available);
 RETURN rid;
END $$;
CREATE FUNCTION public.heartbeat_group_live(_room uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE public.group_live_members SET heartbeat_at=now() WHERE room_id=_room AND user_id=auth.uid() $$;
CREATE FUNCTION public.leave_group_live(_room uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 DELETE FROM public.group_live_members WHERE room_id=_room AND user_id=auth.uid();
 DELETE FROM public.group_live_signals WHERE room_id=_room AND (sender_id=auth.uid() OR recipient_id=auth.uid());
 UPDATE public.group_live_rooms SET ended_at=now() WHERE id=_room AND NOT EXISTS(SELECT 1 FROM public.group_live_members WHERE room_id=_room AND heartbeat_at > now()-interval '45 seconds');
END $$;
REVOKE ALL ON FUNCTION public.join_group_live(uuid),public.heartbeat_group_live(uuid),public.leave_group_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_group_live(uuid),public.heartbeat_group_live(uuid),public.leave_group_live(uuid) TO authenticated;