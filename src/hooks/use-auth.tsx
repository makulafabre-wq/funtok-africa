import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { listenConversations, type Conversation, type PersonInfo } from "@/lib/chat";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  return { user, ready, profile: profile.data ?? null };
}

export const toPerson = (p: { username: string; display_name: string | null; avatar_url: string | null }): PersonInfo => ({
  username: p.username, displayName: p.display_name ?? p.username, avatarUrl: p.avatar_url,
});

export function useConversations(me: string | undefined) {
  const [list, setList] = useState<Conversation[]>([]);
  useEffect(() => { if (!me) return; return listenConversations(me, setList); }, [me]);
  // Clear the badge instantly when a chat is opened, before the server confirms
  useEffect(() => {
    if (!me) return;
    const onRead = (e: Event) => {
      const cid = (e as CustomEvent<string>).detail;
      setList((l) => l.map((c) => (c.id === cid ? { ...c, unread: { ...(c.unread ?? {}), [me]: 0 } } : c)));
    };
    window.addEventListener("funtok-read", onRead);
    return () => window.removeEventListener("funtok-read", onRead);
  }, [me]);
  const unread = me ? list.reduce((n, c) => n + (c.unread?.[me] ?? 0), 0) : 0;
  return { conversations: list, unread };
}
