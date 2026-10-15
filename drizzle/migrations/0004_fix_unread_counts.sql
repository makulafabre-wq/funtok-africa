CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_at = NEW.created_at,
    last_message = CASE WHEN NEW.video_share_id IS NOT NULL THEN '🎥 Video'
      WHEN NEW.image_url IS NOT NULL THEN '📷 Photo'
      WHEN NEW.audio_url IS NOT NULL THEN '🎤 Voice message'
      WHEN NEW.file_url IS NOT NULL THEN '📄 ' || coalesce(NEW.file_name, 'File')
      ELSE left(NEW.text, 120) END
  WHERE id = NEW.conversation_id;
  UPDATE public.conversation_members SET unread = unread + 1
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;
  -- Sending a message means you have seen the chat: clear your own count
  UPDATE public.conversation_members SET typing_at = NULL, unread = 0, last_read_at = now()
    WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  RETURN NEW;
END $$;

-- Repair existing counts: only messages from others after the last read time
UPDATE public.conversation_members cm SET unread = (
  SELECT count(*) FROM public.messages m
  WHERE m.conversation_id = cm.conversation_id AND m.sender_id <> cm.user_id AND m.created_at > cm.last_read_at
);