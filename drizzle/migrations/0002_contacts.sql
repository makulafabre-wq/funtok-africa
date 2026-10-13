CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  contact_user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts own all" ON public.contacts FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_phones TO authenticated;
GRANT SELECT ON public.conversations, public.conversation_members, public.messages TO authenticated;
GRANT INSERT ON public.messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text), public.start_conversation(uuid), public.mark_read(text), public.set_typing(text, boolean) TO authenticated;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN others THEN NULL; END;
END $$;
CREATE POLICY "members see co-members" ON public.profiles FOR SELECT TO authenticated USING (true);