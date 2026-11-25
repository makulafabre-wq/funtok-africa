import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Search,
  MoreVertical,
  UserPlus,
  Archive,
  Phone,
  User,
  Loader2,
  Check,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useConversations, toPerson } from "@/hooks/use-auth";
import { useHorizontalSwipe } from "@/hooks/use-swipe";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationId,
  ensureConversation,
  getMyPhone,
  saveMyPhone,
  addContact,
  formatChatTime,
  listenMessages,
  markRead,
  sendMessage,
  setTyping,
  type Conversation,
  type Message,
} from "@/lib/chat";
import { Avatar } from "@/components/funtok/Avatar";
import { BottomNav } from "@/components/funtok/BottomNav";
import { SideToggle } from "@/components/funtok/SideToggle";
import { Logo } from "@/components/funtok/Logo";
import { BannerAd } from "@/components/funtok/Ads";
import { ChatComposer } from "@/components/funtok/ChatComposer";
import {
  ChatMainMenu,
  ThreadMenu,
  usePref,
  textSizeClass,
  wallpaperClass,
  playPing,
} from "@/components/funtok/ChatMenus";
import { isChatOnline, isChatTyping } from "@/lib/chat-status";

export const Route = createFileRoute("/chat")({
  validateSearch: (s: Record<string, unknown>): { user?: string | undefined } => ({
    user: typeof s["user"] === "string" ? s["user"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat Side — Funtok" },
      { name: "description", content: "Message friends on Funtok and share Fun Side videos right in the chat." },
    ],
  }),
  component: ChatSide,
});

function ChatSide() {
  const { user: other } = Route.useSearch();
  const navigate = useNavigate();
  const { user, ready, profile } = useAuth();
  const { conversations } = useConversations(user?.id);
  const [shareStatus] = usePref("showOnline", true);

  useEffect(() => {
    if (!user) return;
    const update = () => {
      void supabase.rpc("update_chat_presence", {
        _online: document.visibilityState === "visible",
        _share: shareStatus,
      });
    };
    update();
    const timer = setInterval(update, 45000);
    document.addEventListener("visibilitychange", update);
    const leave = () => {
      void supabase.rpc("update_chat_presence", { _online: false, _share: shareStatus });
    };
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [user?.id, shareStatus]);

  const [search, setSearch] = useState("");
  const [myPhone, setMyPhone] = useState<string | null | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (user) {
      getMyPhone(user.id).then((p) => {
        setMyPhone(p || "skipped");
      });
    }
  }, [user]);

  const swipe = useHorizontalSwipe(undefined, () => {
    if (!other) navigate({ to: "/" });
  });

  useEffect(() => {
    if (!user || !profile || !other || other === user.id) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", other)
      .maybeSingle()
      .then(({ data }) => {
        if (data) ensureConversation(user.id, toPerson(profile), other, toPerson(data)).catch(console.error);
      });
  }, [user, profile, other]);

  const activeId = user && other ? conversationId(user.id, other) : null;
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const [archived] = usePref<string[]>("archived", []);
  const [blocked] = usePref<string[]>("blocked", []);
  const [muted] = usePref<string[]>("muted", []);
  const [notify] = usePref("notify", true);
  const [sound] = usePref("notifySound", true);
  const [preview] = usePref("notifyPreview", true);
  const [showArchived, setShowArchived] = useState(false);

  const prevUnread = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    if (!user) return;
    const now = Object.fromEntries(conversations.map((c) => [c.id, c.unread?.[user.id] ?? 0]));
    const prev = prevUnread.current;
    prevUnread.current = now;
    if (!prev || !notify) return;
    for (const c of conversations) {
      if ((now[c.id] ?? 0) <= (prev[c.id] ?? 0)) continue;
      const o = c.participants.find((p) => p !== user.id) ?? "";
      if (muted.includes(o) || blocked.includes(o)) continue;
      if (c.id === activeId && document.visibilityState === "visible") continue;
      if (sound) playPing();
      const name = c.participantInfo?.[o]?.displayName ?? "Funtok";
      const body = preview ? c.lastMessage || "New message" : "New message";
      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
        new Notification(name, { body });
      } else {
        toast(name, { description: body });
      }
    }
  }, [conversations]);

  const otherOf = (c: Conversation) => c.participants.find((p) => p !== user?.id) ?? "";
  const archivedCount = conversations.filter((c) => archived.includes(c.id)).length;
  const filtered = conversations
    .filter((c) => (showArchived ? archived.includes(c.id) : !archived.includes(c.id)) && !blocked.includes(otherOf(c)))
    .filter((c) => {
      const o = c.participants.find((p) => p !== user?.id) ?? "";
      return (c.participantInfo?.[o]?.displayName ?? "").toLowerCase().includes(search.toLowerCase());
    });

  return (
    <div className="flex h-[100dvh] flex-col bg-background" {...swipe}>
      <header className={`${other ? "hidden md:flex" : "flex"} items-center justify-between px-4 pt-3`}>
        <Logo size="sm" />
        <SideToggle active="chat" />
        <div className="flex items-center gap-1">
          <button
            aria-label="Search"
            onClick={() => setShowSearch((v) => !v)}
            className="rounded-full p-2 hover:bg-secondary"
          >
            <Search className="h-5 w-5" />
          </button>
          {user ? <ChatMainMenu me={user.id} onNewChat={() => setAdding(true)} /> : <MoreVertical className="h-5 w-5 opacity-40" />}
        </div>
      </header>

      {!ready ? null : !user ? (
        <Notice
          title="Sign in to chat"
          body="Your Chat Side conversations live here."
          cta={
            <Link to="/auth" className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow">
              Sign in
            </Link>
          }
        />
      ) : myPhone === undefined ? null : myPhone === null ? (
        <PhoneSetup me={user.id} onDone={(p) => setMyPhone(p)} onSkip={() => setMyPhone("skipped")} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className={`${other ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-[32%] md:min-w-72`}>
            {showSearch && (
              <div className="px-4 pb-2 pt-1">
                <label className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    placeholder="Search chats..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </div>
            )}
            <button
              onClick={() => setAdding(true)}
              className="mx-4 mb-2 flex items-center gap-3 rounded-xl bg-primary/15 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary/25"
            >
              <UserPlus className="h-5 w-5" /> Start new chat
            </button>
            {adding && (
              <AddChat
                me={user.id}
                onClose={() => setAdding(false)}
                onAdded={(uid) => {
                  setAdding(false);
                  navigate({ to: "/chat", search: { user: uid } });
                }}
              />
            )}
            <div className="flex-1 overflow-y-auto">
              {(archivedCount > 0 || showArchived) && (
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="flex w-full items-center gap-4 px-6 py-3 text-left text-sm font-medium hover:bg-secondary/60"
                >
                  {showArchived ? (
                    <>
                      <ArrowLeft className="h-5 w-5 text-primary" />
                      Back to chats
                    </>
                  ) : (
                    <>
                      <Archive className="h-5 w-5 text-primary" />
                      <span className="flex-1">Archived</span>
                      <span className="text-xs text-primary">{archivedCount}</span>
                    </>
                  )}
                </button>
              )}
              {filtered.length === 0 && (
                <p className="px-6 pt-10 text-center text-sm text-muted-foreground">
                  No chats yet. Tap &ldquo;Start new chat&rdquo; to find creators.
                </p>
              )}
              {filtered.map((c) => {
                const o = c.participants.find((p) => p !== user.id) ?? user.id;
                const info = c.participantInfo?.[o];
                const unread = c.unread?.[user.id] ?? 0;
                const online = isChatOnline(c.presence?.[o]);
                return (
                  <Link
                    key={c.id}
                    to="/chat"
                    search={{ user: o }}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60 ${
                      c.id === activeId ? "bg-secondary" : ""
                    }`}
                  >
                    <Avatar url={info?.avatarUrl} name={info?.displayName} size={54} online={online} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold">{info?.displayName ?? "Chat"}</p>
                        <span className={`shrink-0 text-xs ${unread ? "font-semibold text-accent" : "text-muted-foreground"}`}>
                          {formatChatTime(c.lastAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                          {isChatTyping(c.typing?.[o]) ? <span className="text-primary font-medium">typing…</span> : c.lastMessage || "Say hi 👋"}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
          <section className={`${other ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
            {active ? (
              <ChatThread convo={active} me={user.id} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {other ? "Opening chat…" : "Pick a chat to start messaging"}
              </div>
            )}
          </section>
        </div>
      )}
      {!other && (
        <>
          <BannerAd />
          <BottomNav />
        </>
      )}
    </div>
  );
}

function PhoneSetup({ me, onDone, onSkip }: { me: string; onDone: (p: string) => void; onSkip: () => void }) {
  const [phone, setPhone] = useState("+256");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await saveMyPhone(me, phone);
          onDone(phone);
          toast.success("Phone saved!");
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center"
    >
      <p className="font-display text-2xl font-bold">Add your phone number</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Let friends easily connect with you on Funtok Chat. You can also skip this for now.
      </p>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder="+256 7XX XXX XXX"
        className="w-full max-w-xs rounded-xl bg-secondary px-4 py-3 text-center text-lg outline-none"
      />
      <div className="w-full max-w-xs space-y-2">
        <button
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save number"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}

function AddChat({ me, onClose, onAdded }: { me: string; onClose: () => void; onAdded: (uid: string) => void }) {
  const [tab, setTab] = useState<"search" | "phone">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>>([]);
  const [searching, setSearching] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+256");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tab !== "search" || !query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .neq("id", me)
        .or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`)
        .limit(10);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, tab, me]);

  return (
    <div className="mx-4 mb-3 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="font-display font-bold text-base">New message</p>
        <div className="flex gap-1 rounded-lg bg-secondary p-0.5 text-xs font-semibold">
          <button
            onClick={() => setTab("search")}
            className={`rounded-md px-2.5 py-1 transition-colors ${tab === "search" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Find user
          </button>
          <button
            onClick={() => setTab("phone")}
            className={`rounded-md px-2.5 py-1 transition-colors ${tab === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            By phone
          </button>
        </div>
      </div>

      {tab === "search" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username (e.g. makula)"
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {searching ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Searching users…
              </div>
            ) : results.length > 0 ? (
              results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onAdded(u.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-secondary/70 transition-colors"
                >
                  <Avatar url={u.avatar_url} name={u.username} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.display_name || u.username}</p>
                    <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                </button>
              ))
            ) : query.trim() ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No user found matching &ldquo;{query}&rdquo;</p>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">Type a username to start chatting</p>
            )}
          </div>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const uid = await addContact(me, name, phone);
              toast.success(`${name} added`);
              onAdded(uid);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend's Name"
            className="w-full rounded-xl bg-secondary px-3 py-2 text-sm outline-none"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+256 7XX XXX XXX"
            className="w-full rounded-xl bg-secondary px-3 py-2 text-sm outline-none"
          />
          <button
            disabled={busy}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add & chat"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl bg-secondary py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
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
  const [wall] = usePref("wallpaper", "doodle");
  const [cleared] = usePref<Record<string, string>>("clearedAt", {});
  const [blocked, setBlocked] = usePref<string[]>("blocked", []);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const otherId = convo.participants.find((p) => p !== me) ?? me;
  const info = convo.participantInfo?.[otherId];

  useEffect(() => listenMessages(convo.id, setMessages), [convo.id]);
  useEffect(() => {
    markRead(convo.id, me);
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, convo.id, me]);

  const typing = isChatTyping(convo.typing?.[otherId]);
  const online = isChatOnline(convo.presence?.[otherId]);
  const isBlocked = blocked.includes(otherId);

  const clearedTs = cleared[convo.id] ? new Date(cleared[convo.id]).getTime() : 0;
  const visibleMessages = messages.filter((m) => new Date(m.created_at).getTime() > clearedTs);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/chat" className="p-1 hover:bg-secondary rounded-full md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Avatar url={info?.avatarUrl} name={info?.displayName} size={40} online={online} />
          <div>
            <p className="font-semibold text-sm leading-tight">{info?.displayName ?? "User"}</p>
            <p className="text-xs text-muted-foreground">
              {typing ? <span className="text-primary font-medium">typing…</span> : online ? <span className="text-emerald-500">online</span> : "offline"}
            </p>
          </div>
        </div>
        <ThreadMenu
          convoId={convo.id}
          otherId={otherId}
          otherName={info?.displayName ?? "User"}
          isBlocked={isBlocked}
          onToggleBlock={() => {
            setBlocked((b) => (b.includes(otherId) ? b.filter((x) => x !== otherId) : [...b, otherId]));
          }}
        />
      </div>

      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${wallpaperClass(wall)} ${textSizeClass(size)}`}>
        {visibleMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No messages yet. Send a message to start the conversation!
          </div>
        ) : (
          visibleMessages.map((m) => {
            const isMe = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMe
                      ? "rounded-tr-xs bg-primary text-primary-foreground shadow-glow"
                      : "rounded-tl-xs bg-card border border-border text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75`}>
                    <span>{formatChatTime(m.created_at)}</span>
                    {isMe && receipts && (
                      m.read_by && m.read_by.length > 1 ? (
                        <CheckCheck className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      {isBlocked ? (
        <div className="border-t border-border bg-card p-3 text-center text-xs text-muted-foreground">
          You have blocked this user. Unblock them in settings to send messages.
        </div>
      ) : (
        <ChatComposer
          onSend={(text) => {
            if (!text.trim()) return;
            void sendMessage(convo.id, me, text);
          }}
          onTyping={(isTypingNow) => {
            if (showOnline) void setTyping(convo.id, me, isTypingNow);
          }}
        />
      )}
    </div>
  );
}
