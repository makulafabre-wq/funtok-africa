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
  readAt?: Record<string, string>;
};
export type Message = {
  id: string;
  senderId: string;
  text?: string;
  videoShareId?: string | null;
  videoRowId?: string | null;
  imagePath?: string | null;
  audioPath?: string | null;
  createdAt?: string;
  pending?: boolean;
};

export const conversationId = (a: string, b: string) => [a, b].sort().join("_");

export async function startConversation(other: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_conversation", { _other: other });
  if (error) throw error;
  return data as string;
}

export async function findUserByPhone(phone: string): Promise<string | null> {
  const { data } = await supabase.rpc("find_user_by_phone", { _phone: normalizePhone(phone) });
  return (data as string | null) ?? null;
}

export function normalizePhone(p: string) {
  let v = p.replace(/[^0-9+]/g, "");
  if (v.startsWith("0")) v = "+256" + v.slice(1);
  if (!v.startsWith("+")) v = "+" + v;
  return v;
}

export async function sendMessage(
  convo: Pick<Conversation, "id">,
  senderId: string,
  payload: { text?: string; videoShareId?: string; videoRowId?: string; imagePath?: string; audioPath?: string },
) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: convo.id,
    sender_id: senderId,
    text: payload.text ?? "",
    video_share_id: payload.videoShareId ?? null,
    video_row_id: payload.videoRowId ?? null,
    image_url: payload.imagePath ?? null,
    audio_url: payload.audioPath ?? null,
  });
  if (error) throw error;
}

export async function uploadChatMedia(cid: string, me: string, file: Blob, ext: string): Promise<string> {
  const path = `${cid}/${me}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

const urlCache = new Map<string, string>();
export async function mediaUrl(path: string): Promise<string | null> {
  if (urlCache.has(path)) return urlCache.get(path)!;
  const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 6);
  if (data?.signedUrl) urlCache.set(path, data.signedUrl);
  return data?.signedUrl ?? null;
}

export const markRead = (cid: string, _me?: string) => { void supabase.rpc("mark_read", { _cid: cid }); };
export const setTyping = (cid: string, _me: string, on: boolean) => { void supabase.rpc("set_typing", { _cid: cid, _on: on }); };

async function loadConversations(me: string): Promise<Conversation[]> {
  const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", me);
  const ids = (mine ?? []).map((r) => r.conversation_id);
  if (!ids.length) return [];
  const [{ data: convos }, { data: members }] = await Promise.all([
    supabase.from("conversations").select("*").in("id", ids),
    supabase.from("conversation_members").select("*").in("conversation_id", ids),
  ]);
  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const list: Conversation[] = (convos ?? []).map((c) => {
    const ms = (members ?? []).filter((m) => m.conversation_id === c.id);
    const info: Record<string, PersonInfo> = {};
    const unread: Record<string, number> = {};
    const typing: Record<string, string | null> = {};
    const readAt: Record<string, string> = {};
    for (const m of ms) {
      const p = pmap.get(m.user_id);
      info[m.user_id] = { username: p?.username ?? "user", displayName: p?.display_name ?? p?.username ?? "User", avatarUrl: p?.avatar_url ?? null };
      unread[m.user_id] = m.unread; typing[m.user_id] = m.typing_at; readAt[m.user_id] = m.last_read_at;
    }
    return { id: c.id, participants: ms.map((m) => m.user_id), participantInfo: info, lastMessage: c.last_message, lastAt: c.last_at, unread, typing, readAt };
  });
  list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return list;
}

export function listenConversations(me: string, cb: (c: Conversation[]) => void) {
  let alive = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => { clearTimeout(t); t = setTimeout(() => loadConversations(me).then((l) => alive && cb(l)).catch(console.error), 150); };
  refresh();
  const ch = supabase.channel(`convos-${me}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh)
    .subscribe();
  const iv = setInterval(refresh, 30000);
  return () => { alive = false; clearInterval(iv); clearTimeout(t); void supabase.removeChannel(ch); };
}

type Row = { id: string; sender_id: string; text: string; video_share_id: string | null; video_row_id: string | null; image_url: string | null; audio_url: string | null; created_at: string };
const toMsg = (r: Row): Message => ({
  id: r.id, senderId: r.sender_id, text: r.text, videoShareId: r.video_share_id, videoRowId: r.video_row_id,
  imagePath: r.image_url, audioPath: r.audio_url, createdAt: r.created_at,
});

export function listenMessages(cid: string, cb: (m: Message[]) => void) {
  let list: Message[] = [];
  let alive = true;
  supabase.from("messages").select("*").eq("conversation_id", cid).order("created_at", { ascending: true }).limit(300)
    .then(({ data }) => { if (!alive) return; list = (data ?? []).map((r) => toMsg(r as Row)); cb(list); });
  const ch = supabase.channel(`msgs-${cid}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` }, (p) => {
      const m = toMsg(p.new as Row);
      if (list.some((x) => x.id === m.id)) return;
      list = [...list, m]; cb(list);
    })
    .subscribe();
  return () => { alive = false; void supabase.removeChannel(ch); };
}

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

export const msTs = (ts?: string | null) => (ts ? new Date(ts).getTime() : 0);
