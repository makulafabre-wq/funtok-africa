import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, Send, Video, Play } from "lucide-react";
import { useAuth, useConversations, toPerson } from "@/hooks/use-auth";
import { useHorizontalSwipe } from "@/hooks/use-swipe";
import { supabase } from "@/integrations/supabase/client";
import { firebaseReady } from "@/lib/firebase";
import {
  conversationId, ensureConversation, formatChatTime, listenMessages, markRead, sendMessage, setTyping,
  type Conversation, type Message,
} from "@/lib/chat";
import { playlistUrl, thumbUrl } from "@/lib/bunny";
import { Avatar } from "@/components/funtok/Avatar";
import { BottomNav } from "@/components/funtok/BottomNav";
import { SideToggle } from "@/components/funtok/SideToggle";
import { Logo } from "@/components/funtok/Logo";
import { BannerAd } from "@/components/funtok/Ads";
import { VideoPlayer } from "@/components/funtok/VideoPlayer";

export const Route = createFileRoute("/chat")({
  validateSearch: (s: Record<string, unknown>): { user?: string } => ({ user: typeof s.user === "string" ? s.user : undefined }),
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
  const swipe = useHorizontalSwipe(undefined, () => { if (!other) navigate({ to: "/" }); });

  // Open/create a conversation with ?user=
  useEffect(() => {
    if (!user || !profile || !other || other === user.id || !firebaseReady) return;
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
        <span className="w-16" />
      </header>

      {!ready ? null : !user ? (
        <Notice title="Sign in to chat" body="Your Chat Side conversations live here." cta={<Link to="/auth" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">Sign in</Link>} />
      ) : !firebaseReady ? (
        <Notice title="Chat is almost ready" body="The chat service still needs its connection details. Once they're added, conversations appear here in real time." />
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className={`${other ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-[30%] md:min-w-72`}>
            <div className="p-3">
              <label className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && <p className="px-6 pt-10 text-center text-sm text-muted-foreground">No chats yet. Open a creator's profile and tap Message.</p>}
              {filtered.map((c) => {
                const o = c.participants.find((p) => p !== user.id) ?? user.id;
                const info = c.participantInfo?.[o];
                const unread = c.unread?.[user.id] ?? 0;
                return (
                  <Link key={c.id} to="/chat" search={{ user: o }} className={`flex items-center gap-3 px-4 py-3 hover:bg-secondary ${c.id === activeId ? "bg-secondary" : ""}`}>
                    <Avatar url={info?.avatarUrl} name={info?.displayName} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{info?.displayName ?? "Chat"}</p>
                      <p className={`truncate text-sm ${unread ? "text-foreground" : "text-muted-foreground"}`}>{isTyping(c, o) ? "typing…" : c.lastMessage || "Say hi 👋"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">{formatChatTime(c.lastAt)}</span>
                      {unread > 0 && <span className="rounded-md bg-accent px-1.5 text-xs font-bold text-accent-foreground">{unread}</span>}
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
  return !!t && Date.now() - t.toMillis() < 6000;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const otherId = convo.participants.find((p) => p !== me) ?? me;
  const info = convo.participantInfo?.[otherId];

  useEffect(() => listenMessages(convo.id, setMessages), [convo.id]);
  useEffect(() => { markRead(convo.id, me); bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, convo.id, me]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendMessage(convo, me, { text: t.slice(0, 2000) });
  };

  const onType = (v: string) => {
    setText(v);
    setTyping(convo.id, me, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(convo.id, me, false), 4000);
  };

  const typing = useMemo(() => isTyping(convo, otherId), [convo, otherId]);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <Link to="/chat" className="md:hidden" aria-label="Back"><ArrowLeft className="h-6 w-6" /></Link>
        <Link to="/profile/$id" params={{ id: otherId }} className="flex flex-1 items-center gap-3">
          <Avatar url={info?.avatarUrl} name={info?.displayName} size={40} />
          <div>
            <p className="font-semibold leading-tight">{info?.displayName}</p>
            <p className="text-xs text-muted-foreground">{typing ? "typing…" : `@${info?.username ?? ""}`}</p>
          </div>
        </Link>
        <button aria-label="Video call" className="rounded-full bg-secondary p-2.5"><Video className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {messages.map((m) => <Bubble key={m.id} m={m} mine={m.senderId === me} />)}
        {typing && <div className="w-16 rounded-2xl bg-bubble-them px-3 py-2 text-center text-muted-foreground">•••</div>}
        <div ref={bottom} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input value={text} onChange={(e) => onType(e.target.value)} placeholder="Message…" className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
        <button className="rounded-full bg-primary p-3 text-primary-foreground" aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </>
  );
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
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
        {m.text && <p className="whitespace-pre-wrap break-words px-3 py-2 text-sm">{m.text}</p>}
        <p className={`px-3 pb-1 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatChatTime(m.createdAt)}</p>
      </div>
    </div>
  );
}
