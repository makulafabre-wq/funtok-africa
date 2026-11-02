CREATE TABLE public.live_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('battle','random')),
  host_id uuid NOT NULL,
  guest_id uuid,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','live','ended')),
  host_votes integer NOT NULL DEFAULT 0,
  guest_votes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz
);
GRANT SELECT ON public.live_rooms TO anon, authenticated;
GRANT ALL ON public.live_rooms TO service_role;
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live rooms read" ON public.live_rooms FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.join_live(_mode text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); rid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.live_rooms SET status='ended' WHERE host_id = me AND status = 'waiting';
  SELECT id INTO rid FROM public.live_rooms
    WHERE mode=_mode AND status='waiting' AND host_id<>me AND created_at > now()-interval '10 minutes'
    ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF rid IS NOT NULL THEN
    UPDATE public.live_rooms SET guest_id=me, status='live', started_at=now() WHERE id=rid;
    RETURN rid;
  END IF;
  INSERT INTO public.live_rooms(mode, host_id) VALUES (_mode, me) RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.leave_live(_room uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.live_rooms SET status='ended' WHERE id=_room AND (host_id=auth.uid() OR guest_id=auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.vote_live(_room uuid, _side text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.live_rooms SET
    host_votes = host_votes + CASE WHEN _side='host' THEN 1 ELSE 0 END,
    guest_votes = guest_votes + CASE WHEN _side='guest' THEN 1 ELSE 0 END
  WHERE id=_room AND status='live' AND auth.uid() IS NOT NULL
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms;