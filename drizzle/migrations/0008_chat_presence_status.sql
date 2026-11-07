ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_last_seen_at timestamptz, ADD COLUMN IF NOT EXISTS chat_online_until timestamptz;
CREATE OR REPLACE FUNCTION public.update_chat_presence(_online boolean, _share boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 UPDATE public.profiles SET chat_last_seen_at = CASE WHEN _share THEN now() ELSE NULL END, chat_online_until = CASE WHEN _share AND _online THEN now() + interval '75 seconds' ELSE NULL END WHERE id = auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.update_chat_presence(boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_chat_presence(boolean, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.update_chat_presence(boolean, boolean) TO service_role;