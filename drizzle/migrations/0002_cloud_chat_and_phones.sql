CREATE TABLE public.conversations (
  id text PRIMARY KEY,
  last_message text NOT NULL DEFAULT '',
  last_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.conversation_members (
  conversation_id text NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  unread integer NOT NULL DEFAULT 0,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  typing_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  text text NOT NULL DEFAULT '',
  video_share_id text,
  video_row_id text,
  image_url text,
  audio_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_convo_idx ON public.messages(conversation_id, created_at);
CREATE TABLE public.user_phones (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_phones TO authenticated;
GRANT ALL ON public.conversations, public.conversation_members, public.messages, public.user_phones TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_phones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_cid text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = _cid AND user_id = auth.uid())
$$;

CREATE POLICY "convo members read" ON public.conversations FOR SELECT TO authenticated USING (public.is_member(id));
CREATE POLICY "members read" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_member(conversation_id));
CREATE POLICY "messages read" ON public.messages FOR SELECT TO authenticated USING (public.is_member(conversation_id));
CREATE POLICY "messages send" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_member(conversation_id));
CREATE POLICY "phone own select" ON public.user_phones FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "phone own insert" ON public.user_phones FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "phone own update" ON public.user_phones FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "phone own delete" ON public.user_phones FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.start_conversation(_other uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); cid text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF me = _other THEN RAISE EXCEPTION 'Cannot chat with yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other) THEN RAISE EXCEPTION 'User not found'; END IF;
  cid := CASE WHEN me::text < _other::text THEN me::text || '_' || _other::text ELSE _other::text || '_' || me::text END;
  INSERT INTO public.conversations(id) VALUES (cid) ON CONFLICT DO NOTHING;
  INSERT INTO public.conversation_members(conversation_id, user_id) VALUES (cid, me), (cid, _other) ON CONFLICT DO NOTHING;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.find_user_by_phone(_phone text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_phones WHERE phone = regexp_replace(_phone, '[^0-9+]', '', 'g') LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mark_read(_cid text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversation_members SET unread = 0, last_read_at = now() WHERE conversation_id = _cid AND user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.set_typing(_cid text, _on boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversation_members SET typing_at = CASE WHEN _on THEN now() ELSE NULL END WHERE conversation_id = _cid AND user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_at = NEW.created_at,
    last_message = CASE WHEN NEW.video_share_id IS NOT NULL THEN '🎥 Video'
      WHEN NEW.image_url IS NOT NULL THEN '📷 Photo'
      WHEN NEW.audio_url IS NOT NULL THEN '🎤 Voice message'
      ELSE left(NEW.text, 120) END
  WHERE id = NEW.conversation_id;
  UPDATE public.conversation_members SET unread = unread + 1 WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;
  UPDATE public.conversation_members SET typing_at = NULL, last_read_at = now() WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.conversation_members, public.conversations;

CREATE POLICY "chat media upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND public.is_member((storage.foldername(name))[1]) AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "chat media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media' AND public.is_member((storage.foldername(name))[1]));