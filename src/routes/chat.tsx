import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Search, Send, Video, Play, MoreVertical, Phone, Check, CheckCheck, Mic, Square, Smile, Paperclip, MessageSquarePlus, X, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useConversations } from "@/hooks/use-auth";
import { useHorizontalSwipe } from "@/hooks/use-swipe";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationId, findUserByPhone, formatChatTime, listenMessages, markRead, mediaUrl, msTs, normalizePhone,
  sendMessage, setTyping, startConversation, uploadChatMedia,
  type Conversation, type Message,
} from "@/lib/chat";
import { playlistUrl, thumbUrl } from "@/lib/bunny";
import { Avatar } from "@/components/funtok/Avatar";
import { BottomNav } from "@/components/funtok/BottomNav";
import { SideToggle } from "@/components/funtok/SideToggle";
import { Logo } from "@/components/funtok/Logo";
import { BannerAd } from "@/components/funtok/Ads";
import { VideoPlayer } from "@/components/funtok/VideoPlayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/chat")({
  validateSearch: (s: Record<string, unknown>): { user?: string | undefined } => ({ user: typeof s["user"] === "string" ? s["user"] : undefined }),
  head: () => ({
    meta: [
      { title: "Chat Side — Funtok" },
      { name: "description", content: "Message friends on Funtok by phone number, send voice notes, photos and Fun Side videos." },
      { property: "og:title", content: "Chat Side — Funtok" },
      { property: "og:description", content: "WhatsApp-style chat with voice notes, photos and video sharing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatSide,
});

function ChatSide() {
  const { user: other } = Route.useSearch();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { conversations } = useConversations(user?.id);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [myPhone, setMyPhone] = useState<string | null | undefined>(undefined);
  const swipe = useHorizontalSwipe(undefined, () => { if (!other) navigate({ to: "/" }); });

  useEffect(() => {
    if (!user) return;
    supabase.from("user_phones").select("phone").eq("user_id", user.id).maybeSingle().then(({ data }) => setMyPhone(data?.phone ?? null));
  }, [user]);

  useEffect(() => {
    if (!user || !other || other === user.id) return;
    startConversation(other).catch((e: Error) => toast.error(e.message));
  }, [user, other]);

  const activeId = user && other ? conversationId(user.id, other) : null;
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const filtered = conversations.filter((c) => {
    const o = c.participants.find((p) => p !== user?.id) ?? "";
    return (c.participantInfo?.[o]?.displayName ?? "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex h-[100dvh] flex-col bg-background" {...swipe}>
      <header className={`${other ? "hidden md:flex" : "flex"} items-center justify-between px-4 pt-3`}>
        <Logo size="sm" />
        <SideToggle active="chat" />
        <div className="flex items-center gap-1">
          <button aria-label="New chat" onClick={() => setNewOpen(true)} className="rounded-full p-2 hover:bg-secondary"><MessageSquarePlus className="h-5 w-5" /></button>
          <button aria-label="More" className="rounded-full p-2 hover:bg-secondary"><MoreVertical className="h-5 w-5" /></button>
        </div>
      </header>

      {!ready ? null : !user ? (
        <Notice title="Sign in to chat" body="Add your phone number and chat with friends like on WhatsApp." cta={<Link to="/auth" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">Sign in</Link>} />
      ) : (
        <div className="relative flex min-h-0 flex-1">
          <aside className={`${other ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-[30%] md:min-w-72`}>
            <div className="px-4 pb-2 pt-1">
              <label className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </label>
            </div>
            {myPhone === null && (
              <button onClick={() => setNewOpen(true)} className="mx-4 mb-2 rounded-xl bg-accent/15 p-3 text-left text-sm">
                <span className="font-semibold text-accent">Add your phone number</span>
                <span className="block text-muted-foreground">So friends can find you and start a chat.</span>
              </button>
            )}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-6 pt-10 text-center text-sm text-muted-foreground">
                  <p>No chats yet.</p>
                  <button onClick={() => setNewOpen(true)} className="mt-3 rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground">Start a chat by number</button>
                </div>
              )}
              {filtered.map((c) => {
                const o = c.participants.find((p) => p !== user.id) ?? user.id;
                const info = c.participantInfo?.[o];
                const unread = c.unread?.[user.id] ?? 0;
                return (
                  <Link key={c.id} to="/chat" search={{ user: o }} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60 ${c.id === activeId ? "bg-secondary" : ""}`}>
                    <Avatar url={info?.avatarUrl} name={info?.displayName} size={54} online={isOnline(c, o)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold">{info?.displayName ?? "Chat"}</p>
                        <span className={`shrink-0 text-xs ${unread ? "font-semibold text-accent" : "text-muted-foreground"}`}>{formatChatTime(c.lastAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                          {isTyping(c, o) ? <span className="text-online">typing…</span> : c.lastMessage || "Say hi 👋"}
                        </p>
                        {unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground">{unread}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {!other && (
              <button aria-label="New chat" onClick={() => setNewOpen(true)} className="absolute bottom-4 right-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg md:hidden">
                <MessageSquarePlus className="h-6 w-6" />
              </button>
            )}
          </aside>
          <section className={`${other ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
            {active ? <ChatThread convo={active} me={user.id} /> : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{other ? "Opening chat…" : "Pick a chat to start messaging"}</div>
            )}
          </section>
        </div>
      )}
      {!other && <><BannerAd /><BottomNav /></>}
      {user && <NewChatDialog open={newOpen} onOpenChange={setNewOpen} me={user.id} myPhone={myPhone ?? null} onSaved={setMyPhone} />}
    </div>
  );
}

function NewChatDialog({ open, onOpenChange, me, myPhone, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; me: string; myPhone: string | null; onSaved: (p: string) => void }) {
  const navigate = useNavigate();
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMine(myPhone ?? ""); }, [myPhone]);
  const valid = (p: string) => /^\+\d{9,15}$/.test(normalizePhone(p));

  const save = async (): Promise<void> => {
    if (!valid(mine)) { toast.error("Enter a valid phone number, e.g. 0772 123456"); return; }
    const phone = normalizePhone(mine);
    const { error } = await supabase.from("user_phones").upsert({ user_id: me, phone });
    if (error) { toast.error(error.code === "23505" ? "That number is already used by another account" : error.message); return; }
    onSaved(phone); toast.success("Number saved");
  };
  const start = async (): Promise<void> => {
    if (!valid(theirs)) { toast.error("Enter a valid phone number"); return; }
    setBusy(true);
    const id = await findUserByPhone(theirs);
    setBusy(false);
    if (!id) { toast.error("No Funtok user has that number yet"); return; }
    if (id === me) { toast.error("That's your own number"); return; }
    onOpenChange(false); setTheirs("");
    navigate({ to: "/chat", search: { user: id } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover">
        <DialogHeader><DialogTitle>New chat</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-sm font-medium">Chat with a phone number</p>
            <div className="flex gap-2">
              <input value={theirs} onChange={(e) => setTheirs(e.target.value)} inputMode="tel" placeholder="0772 123456 or +256…" className="flex-1 rounded-lg bg-secondary px-3 py-2.5 text-sm outline-none" />
              <button disabled={busy} onClick={start} className="rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Chat</button>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <p className="mb-1.5 text-sm font-medium">Your phone number</p>
            <p className="mb-2 text-xs text-muted-foreground">Friends type this to find you. It's never shown on your profile.</p>
            <div className="flex gap-2">
              <input value={mine} onChange={(e) => setMine(e.target.value)} inputMode="tel" placeholder="0772 123456" className="flex-1 rounded-lg bg-secondary px-3 py-2.5 text-sm outline-none" />
              <button onClick={save} className="rounded-lg bg-secondary px-4 text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isTyping(c: Conversation, who: string) {
  const t = c.typing?.[who];
  return !!t && Date.now() - msTs(t) < 6000;
}
function isOnline(c: Conversation, who: string) {
  const t = c.readAt?.[who];
  return !!t && Date.now() - msTs(t) < 2 * 60 * 1000;
}

function Notice({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-display text-2xl font-bold">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {cta}
    </div>
  );
}

const EMOJIS = "😀 😂 🤣 😍 🥰 😘 😎 🤩 🥳 😇 🙏 👍 👏 🙌 💪 🔥 ❤️ 💯 🎉 😢 😭 😡 🤔 😴 🤗 😜 🤭 👀 💃 🕺 ⚽ 🎵 🇺🇬 ✨ 🌟 😅".split(" ");

function ChatThread({ convo, me }: { convo: Conversation; me: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const otherId = convo.participants.find((p) => p !== me) ?? me;
  const info = convo.participantInfo?.[otherId];
  const otherReadAt = msTs(convo.readAt?.[otherId]);

  useEffect(() => listenMessages(convo.id, (m) => { setMessages(m); setPending([]); }), [convo.id]);
  useEffect(() => { markRead(convo.id); bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, pending.length, convo.id]);
  useEffect(() => {
    if (!recording) return;
    const iv = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  const optimistic = (m: Partial<Message>) => setPending((p) => [...p, { id: `p${Date.now()}`, senderId: me, createdAt: new Date().toISOString(), pending: true, ...m }]);

  const send = async (): Promise<void> => {
    const t = text.trim();
    if (!t) return;
    setText(""); setEmojiOpen(false);
    optimistic({ text: t });
    try { await sendMessage(convo, me, { text: t.slice(0, 2000) }); } catch { toast.error("Message not sent"); }
  };

  const onType = (v: string) => {
    setText(v);
    setTyping(convo.id, me, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(convo.id, me, false), 4000);
  };

  const sendPhoto = async (f: File): Promise<void> => {
    if (!f.type.startsWith("image/")) { toast.error("Pick a photo"); return; }
    if (f.size > 15 * 1024 * 1024) { toast.error("Photo too large (max 15MB)"); return; }
    optimistic({ text: "📷 Sending photo…" });
    try {
      const path = await uploadChatMedia(convo.id, me, f, f.name.split(".").pop() || "jpg");
      await sendMessage(convo, me, { imagePath: path });
    } catch { toast.error("Photo not sent"); setPending([]); }
  };

  const startRec = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.start();
      recorder.current = r; setRecSecs(0); setRecording(true);
    } catch { toast.error("Allow microphone access to record voice notes"); }
  };
  const stopRec = (cancel = false) => {
    const r = recorder.current;
    if (!r) return;
    r.onstop = async () => {
      r.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      if (cancel || chunks.current.length === 0) return;
      const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
      optimistic({ text: "🎤 Sending voice note…" });
      try {
        const ext = (r.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        const path = await uploadChatMedia(convo.id, me, blob, ext);
        await sendMessage(convo, me, { audioPath: path });
      } catch { toast.error("Voice note not sent"); setPending([]); }
    };
    r.stop(); recorder.current = null;
  };

  const typing = useMemo(() => isTyping(convo, otherId), [convo, otherId]);
  const all = [...messages, ...pending];

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Link to="/chat" className="rounded-full p-1.5 hover:bg-secondary md:hidden" aria-label="Back"><ArrowLeft className="h-6 w-6" /></Link>
        <Link to="/profile/$id" params={{ id: otherId }} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar url={info?.avatarUrl} name={info?.displayName} size={42} online={isOnline(convo, otherId)} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{info?.displayName}</p>
            <p className={`text-xs ${typing ? "text-online" : "text-muted-foreground"}`}>{typing ? "typing…" : isOnline(convo, otherId) ? "online" : `@${info?.username ?? ""}`}</p>
          </div>
        </Link>
        <button aria-label="Video call" onClick={() => toast("Video calls are coming soon")} className="rounded-full p-2.5 hover:bg-secondary"><Video className="h-5 w-5" /></button>
        <button aria-label="Voice call" onClick={() => toast("Voice calls are coming soon")} className="rounded-full p-2.5 hover:bg-secondary"><Phone className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {all.length === 0 && <p className="mx-auto mt-6 w-fit rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground">Say hi to {info?.displayName} 👋</p>}
        {all.map((m) => <Bubble key={m.id} m={m} mine={m.senderId === me} read={!!m.createdAt && msTs(m.createdAt) <= otherReadAt} />)}
        {typing && <div className="w-16 rounded-2xl bg-bubble-them px-3 py-2 text-center text-muted-foreground">•••</div>}
        <div ref={bottom} />
      </div>
      {emojiOpen && (
        <div className="grid grid-cols-9 gap-1 border-t border-border bg-card p-2">
          {EMOJIS.map((e) => <button key={e} onClick={() => setText((t) => t + e)} className="rounded p-1 text-xl hover:bg-secondary">{e}</button>)}
        </div>
      )}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendPhoto(f); e.target.value = ""; }} />
      <div className="flex items-center gap-2 border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {recording ? (
          <>
            <button aria-label="Cancel recording" onClick={() => stopRec(true)} className="rounded-full p-2.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
              Recording {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}
            </div>
            <button aria-label="Send voice note" onClick={() => stopRec()} className="rounded-full bg-primary p-3 text-primary-foreground"><Send className="h-4 w-4" /></button>
          </>
        ) : (
          <>
            <div className="flex flex-1 items-center gap-1 rounded-full bg-secondary px-2">
              <button aria-label="Emoji" onClick={() => setEmojiOpen((o) => !o)} className="p-2 text-muted-foreground"><Smile className="h-5 w-5" /></button>
              <input value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder="Message" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
              <button aria-label="Send photo" onClick={() => fileInput.current?.click()} className="p-2 text-muted-foreground"><Paperclip className="h-5 w-5" /></button>
            </div>
            {text.trim() ? (
              <button aria-label="Send" onClick={() => void send()} className="rounded-full bg-primary p-3 text-primary-foreground"><Send className="h-4 w-4" /></button>
            ) : (
              <button aria-label="Record voice note" onClick={() => void startRec()} className="rounded-full bg-primary p-3 text-primary-foreground"><Mic className="h-4 w-4" /></button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function useMedia(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (path) mediaUrl(path).then(setUrl); }, [path]);
  return url;
}

function Ticks({ m, read }: { m: Message; read: boolean }) {
  if (m.pending) return <Clock className="h-3 w-3" />;
  if (read) return <CheckCheck className="h-3.5 w-3.5 text-online" />;
  return <Check className="h-3.5 w-3.5" />;
}

function Bubble({ m, mine, read }: { m: Message; mine: boolean; read: boolean }) {
  const [playing, setPlaying] = useState(false);
  const img = useMedia(m.imagePath);
  const audio = useMedia(m.audioPath);
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] overflow-hidden rounded-2xl ${mine ? "rounded-br-sm bg-bubble-me text-primary-foreground" : "rounded-bl-sm bg-bubble-them"}`}>
        {m.videoShareId && (
          <div className="relative aspect-[9/16] w-48 bg-card">
            {playing ? (
              <VideoPlayer src={playlistUrl(m.videoShareId)} active muted={false} onTap={() => setPlaying(false)} />
            ) : (
              <button onClick={() => setPlaying(true)} className="h-full w-full">
                <img src={thumbUrl(m.videoShareId, 300)} alt="Shared video" className="h-full w-full object-cover" />
                <Play className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 fill-foreground" />
              </button>
            )}
            {m.videoRowId && (
              <Link to="/video/$id" params={{ id: m.videoRowId }} className="absolute bottom-1 left-1 rounded bg-overlay px-2 py-0.5 text-[10px] text-foreground">Open on Fun Side</Link>
            )}
          </div>
        )}
        {m.imagePath && (img ? <a href={img} target="_blank" rel="noreferrer"><img src={img} alt="Photo" className="max-h-80 w-60 object-cover" /></a> : <div className="h-40 w-60 animate-pulse bg-card" />)}
        {m.audioPath && <div className="px-2 pt-2">{audio ? <audio controls src={audio} className="h-10 w-56" /> : <div className="h-10 w-56 animate-pulse rounded bg-card" />}</div>}
        {m.text && <p className="whitespace-pre-wrap break-words px-3 pt-2 text-sm">{m.text}</p>}
        <p className={`flex items-center justify-end gap-1 px-3 pb-1 pt-0.5 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
          {formatChatTime(m.createdAt)}
          {mine && <Ticks m={m} read={read} />}
        </p>
      </div>
    </div>
  );
}
