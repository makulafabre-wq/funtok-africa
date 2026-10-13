import { supabase } from "@/integrations/supabase/client";

export type PersonInfo = { username: string; displayName: string; avatarUrl: string | null };
export type Conversation = {
  id: string;
  participants: string[];
  participantInfo: Record<string, PersonInfo>;
  lastMessage?: string;
  lastAt?: string;
  unread?: Record<string, number>;
  typing?: Record<string, string | null>;
};
export type Message = {
  id: string;
  senderId: string;
  text?: string;
  videoShareId?: string | null;
  videoRowId?: string | null;
  createdAt?: string;
};
export type Contact = { id: string; contact_user_id: string; name: string; phone: string };

export const conversationId = (a: string, b: string) => [a, b].sort().join("_");
export const cleanPhone = (p: string) => p.replace(/[^0-9+]/g, "");

export async function getMyPhone(me: string) {
  const { data } = await supabase.from("user_phones").select("phone").eq("user_id", me).maybeSingle();
  return data?.phone ?? null;
}

export async function saveMyPhone(me: string, phone: string) {
  const p = cleanPhone(phone);
  if (p.length < 9) throw new Error("Enter a valid phone number");
  const taken = await supabase.rpc("find_user_by_phone", { _phone: p });
  if (taken.data && taken.data !== me) throw new Error("This number is already used by another account");
  await supabase.from("user_phones").delete().eq("user_id", me);
  const { error } = await supabase.from("user_phones").insert({ user_id: me, phone: p });
  if (error) throw error;
}

export async function listContacts(me: string): Promise<Contact[]> {
  const { data } = await supabase.from("contacts").select("id,contact_user_id,name,phone").eq("owner_id", me).order("name");
  return data ?? [];
}

export async function addContact(me: string, name: string, phone: string) {
  const p = cleanPhone(phone);
  if (!name.trim()) throw new Error("Enter a name");
  const { data: uid } = await supabase.rpc("find_user_by_phone", { _phone: p });
  if (!uid) throw new Error("This number isn't on Funtok yet. Share the Funtok link with them!");
  if (uid === me) throw new Error("That's your own number");
  const { error } = await supabase.from("contacts").upsert(
    { owner_id: me, contact_user_id: uid as string, name: name.trim().slice(0, 60), phone: p },
    { onConflict: "owner_id,contact_user_id" },
  );
  if (error) throw error;
  await supabase.rpc("start_conversation", { _other: uid as string });
  return uid as string;
}

export async function ensureConversation(_me: string, _meInfo: PersonInfo, other: string, _otherInfo: PersonInfo) {
  const { data, error } = await supabase.rpc("start_conversation", { _other: other });
  if (error) throw error;
  return data as string;
}

export async function sendMessage(convo: Conversation, senderId: string, payload: { text?: string; videoShareId?: string; videoRowId?: string }) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: convo.id, sender_id: senderId, text: payload.text ?? "",
    video_share_id: payload.videoShareId ?? null, video_row_id: payload.videoRowId ?? null,
  });
  if (error) throw error;
}

export const markRead = (cid: string, _me: string) => { void supabase.rpc("mark_read", { _cid: cid }); };
export const setTyping = (cid: string, _me: string, on: boolean) => { void supabase.rpc("set_typing", { _cid: cid, _on: on }); };

async function loadConversations(me: string): Promise<Conversation[]> {
  const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", me);
  const ids = (mine ?? []).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const [{ data: members }, { data: convos }, contacts] = await Promise.all([
    supabase.from("conversation_members").select("*").in("conversation_id", ids),
    supabase.from("conversations").select("*").in("id", ids),
    listContacts(me),
  ]);
  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", userIds);
  const names = new Map(contacts.map((c) => [c.contact_user_id, c]));
  const info: Record<string, PersonInfo> = {};
  for (const p of profiles ?? []) {
    const c = names.get(p.id);
    info[p.id] = { username: c?.phone ?? p.username, displayName: c?.name ?? p.display_name ?? p.username, avatarUrl: p.avatar_url };
  }
  const list = (convos ?? []).map((c) => {
    const ms = (members ?? []).filter((m) => m.conversation_id === c.id);
    return {
      id: c.id,
      participants: ms.map((m) => m.user_id),
      participantInfo: Object.fromEntries(ms.map((m) => [m.user_id, info[m.user_id]!]).filter(([, v]) => v)),
      lastMessage: c.last_message,
      lastAt: c.last_at,
      unread: Object.fromEntries(ms.map((m) => [m.user_id, m.unread])),
      typing: Object.fromEntries(ms.map((m) => [m.user_id, m.typing_at])),
    } as Conversation;
  });
  list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return list;
}

export function listenConversations(me: string, cb: (c: Conversation[]) => void) {
  let alive = true;
  const refresh = () => loadConversations(me).then((l) => alive && cb(l)).catch(console.error);
  refresh();
  const ch = supabase.channel(`convos-${me}-${Math.random()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh)
    .subscribe();
  const t = setInterval(refresh, 8000);
  return () => { alive = false; clearInterval(t); supabase.removeChannel(ch); };
}

export function listenMessages(cid: string, cb: (m: Message[]) => void) {
  let alive = true;
  const refresh = async () => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", cid).order("created_at").limit(300);
    if (alive) cb((data ?? []).map((m) => ({ id: m.id, senderId: m.sender_id, text: m.text, videoShareId: m.video_share_id, videoRowId: m.video_row_id, createdAt: m.created_at })));
  };
  refresh();
  const ch = supabase.channel(`msgs-${cid}-${Math.random()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` }, refresh)
    .subscribe();
  return () => { alive = false; supabase.removeChannel(ch); };
}

export const tsMillis = (t?: string | null) => (t ? new Date(t).getTime() : 0);

export function formatChatTime(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 2) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString();
}
