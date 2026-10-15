import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, Video, Play, MoreVertical, Phone, UserPlus, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useConversations, toPerson } from "@/hooks/use-auth";
import { useHorizontalSwipe } from "@/hooks/use-swipe";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationId, ensureConversation, tsMillis, getMyPhone, saveMyPhone, addContact, formatChatTime, listenMessages, markRead, sendMessage, setTyping,
  type Conversation, type Message,
} from "@/lib/chat";
import { playlistUrl, thumbUrl } from "@/lib/bunny";
import { Avatar } from "@/components/funtok/Avatar";
import { BottomNav } from "@/components/funtok/BottomNav";
import { SideToggle } from "@/components/funtok/SideToggle";
import { Logo } from "@/components/funtok/Logo";
import { BannerAd } from "@/components/funtok/Ads";
import { ChatComposer, MediaContent } from "@/components/funtok/ChatComposer";
import { VideoPlayer } from "@/components/funtok/VideoPlayer";
import { ChatMainMenu, ThreadMenu, usePref, textSizeClass } from "@/components/funtok/ChatMenus";

export const Route = createFileRoute("/chat")({
  validateSearch: (s: Record<string, unknown>): { user?: string | undefined } => ({ user: typeof s["user"] === "string" ? s["user"] : undefined }),
  head: () => ({
    meta: [
      { title: "Chat Side — Funtok" },
      { name: "description", content: "Message friends on Funtok and share Fun Side videos right in the chat." },
      { property: "og:title", content: "Chat Side — Funtok" },
      { property: "og:description", content: "Message friends and share Fun Side videos." },
    ],
  }),
  component: ChatSide,
});

function ChatSide() {
  const { user: other } = Route.useSearch();
  const navigate = useNavigate();
  const { user, ready, profile } = useAuth();
  const { conversations } = useConversations(user?.id);
  const [search, setSearch] = useState("");
  const [myPhone, setMyPhone] = useState<string | null | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  useEffect(() => { if (user) getMyPhone(user.id).then(setMyPhone); }, [user]);
  const swipe = useHorizontalSwipe(undefined, () => { if (!other) navigate({ to: "/" }); });

  // Open/create a conversation with ?user=
  useEffect(() => {
    if (!user || !profile || !other || other === user.id) return;
    supabase.from("profiles").select("*").eq("id", other).maybeSingle().then(({ data }) => {
      if (data) ensureConversation(user.id, toPerson(profile), other, toPerson(data)).catch(console.error);
    });
  }, [user, profile, other]);

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
          <button aria-label="Search" onClick={() => setShowSearch((v) => !v)} className="rounded-full p-2 hover:bg-secondary"><Search className="h-5 w-5" /></button>
          {user ? <ChatMainMenu me={user.id} onNewChat={() => setAdding(true)} /> : <MoreVertical className="h-5 w-5 opacity-40" />}
        </div>
      </header>

      {!ready ? null : !user ? (
        <Notice title="Sign in to chat" body="Your Chat Side conversations live here." cta={<Link to="/auth" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">Sign in</Link>} />
      ) : myPhone === undefined ? null : !myPhone ? (
        <PhoneSetup me={user.id} onDone={setMyPhone} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className={`${other ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-[30%] md:min-w-72`}>
            {showSearch && <div className="px-4 pb-2 pt-1">
              <label className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus placeholder="Search chats..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </label>
            </div>}
            <button onClick={() => setAdding(true)} className="mx-4 mb-2 flex items-center gap-3 rounded-xl bg-primary/15 px-4 py-3 text-left font-semibold text-primary">
              <UserPlus className="h-5 w-5" /> Add chat
            </button>
            {adding && <AddChat me={user.id} onClose={() => setAdding(false)} onAdded={(uid) => { setAdding(false); navigate({ to: "/chat", search: { user: uid } }); }} />}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && <p className="px-6 pt-10 text-center text-sm text-muted-foreground">No chats yet. Tap "Add chat" and enter a friend's number.</p>}
              {filtered.map((c) => {
                const o = c.participants.find((p) => p !== user.id) ?? user.id;
                const info = c.participantInfo?.[o];
                const unread = c.unread?.[user.id] ?? 0;
                const online = isOnline(c, o);
                return (
                  <Link key={c.id} to="/chat" search={{ user: o }} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60 ${c.id === activeId ? "bg-secondary" : ""}`}>
                    <Avatar url={info?.avatarUrl} name={info?.displayName} size={54} online={online} />
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
          </aside>
          <section className={`${other ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
            {active ? <ChatThread convo={active} me={user.id} /> : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{other ? "Opening chat…" : "Pick a chat to start messaging"}</div>
            )}
          </section>
        </div>
      )}
      {!other && <><BannerAd /><BottomNav /></>}
    </div>
  );
}

function isTyping(c: Conversation, who: string) {
  const t = c.typing?.[who];
  return !!t && Date.now() - tsMillis(t) < 6000;
}

function isOnline(c: Conversation, who: string) {
  const t = c.typing?.[who];
  return !!t && Date.now() - tsMillis(t) < 5 * 60 * 1000;
}

function PhoneSetup({ me, onDone }: { me: string; onDone: (p: string) => void }) {
  const [phone, setPhone] = useState("+256");
  const [busy, setBusy] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true);
      try { await saveMyPhone(me, phone); onDone(phone); toast.success("Number saved — you're ready to chat"); }
      catch (err) { toast.error((err as Error).message); } finally { setBusy(false); } }}
      className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="font-display text-2xl font-bold">Save your number</p>
      <p className="text-sm text-muted-foreground">Friends add you on Funtok Chat using your phone number.</p>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+256 7XX XXX XXX" className="w-full max-w-xs rounded-xl bg-secondary px-4 py-3 text-center text-lg outline-none" />
      <button disabled={busy} className="w-full max-w-xs rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Save & continue"}</button>
    </form>
  );
}

function AddChat({ me, onClose, onAdded }: { me: string; onClose: () => void; onAdded: (uid: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+256");
  const [busy, setBusy] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true);
      try { const uid = await addContact(me, name, phone); toast.success(`${name} added`); onAdded(uid); }
      catch (err) { toast.error((err as Error).message); } finally { setBusy(false); } }}
      className="mx-4 mb-3 space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="font-semibold">New contact</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-lg bg-secondary px-3 py-2.5 text-sm outline-none" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Phone number" className="w-full rounded-lg bg-secondary px-3 py-2.5 text-sm outline-none" />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-secondary py-2.5 text-sm">Cancel</button>
        <button disabled={busy} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Adding…" : "Add & chat"}</button>
      </div>
    </form>
  );
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

function ChatThread({ convo, me }: { convo: Conversation; me: string }) {
  const [size] = usePref("textSize", "medium");
  const [receipts] = usePref("readReceipts", true);
  const [showOnline] = usePref("showOnline", true);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const otherId = convo.participants.find((p) => p !== me) ?? me;
  const info = convo.participantInfo?.[otherId];

  useEffect(() => listenMessages(convo.id, setMessages), [convo.id]);
  // Always mark as read when viewing so the unread badge clears immediately
  useEffect(() => { markRead(convo.id, me); bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, convo.id, me]);

  const onType = (_v: string) => {
    if (!showOnline) return;
    setTyping(convo.id, me, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(convo.id, me, false), 4000);
  };

  const typing = useMemo(() => isTyping(convo, otherId), [convo, otherId]);

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
        <button aria-label="Video call" onClick={() => toast("Video calls coming soon")} className="rounded-full p-2.5 hover:bg-secondary"><Video className="h-5 w-5" /></button>
        <button aria-label="Voice call" onClick={() => toast("Voice calls coming soon")} className="rounded-full p-2.5 hover:bg-secondary"><Phone className="h-5 w-5" /></button>
        <ThreadMenu me={me} otherId={otherId} name={info?.displayName} onChanged={() => {}} />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {messages.map((m) => <Bubble key={m.id} m={m} mine={m.senderId === me} size={size} />)}
        {typing && <div className="w-16 rounded-2xl bg-bubble-them px-3 py-2 text-center text-muted-foreground">•••</div>}
        <div ref={bottom} />
      </div>
      <ChatComposer cid={convo.id} me={me} onSend={(p) => sendMessage(convo, me, p)} onType={onType} />
    </>
  );
}

function Bubble({ m, mine, size }: { m: Message; mine: boolean; size: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] overflow-hidden rounded-2xl ${mine ? "rounded-br-sm bg-bubble-me text-primary-foreground" : "rounded-bl-sm bg-bubble-them"}`}>
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
        <MediaContent imageUrl={m.imageUrl} audioUrl={m.audioUrl} fileUrl={m.fileUrl} fileName={m.fileName} />
        {m.text && <p className={`whitespace-pre-wrap break-words px-3 py-2 ${textSizeClass(size)}`}>{m.text}</p>}
        <p className={`px-3 pb-1 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatChatTime(m.createdAt)}</p>
      </div>
    </div>
  );
}
