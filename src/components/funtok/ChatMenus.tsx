import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, UserPlus, Users, Settings, LogOut, Share2, User, Pencil, Trash2, BellOff, Bell, Phone, Info, Lock, Type, MessageCircle, Archive, Ban, Eraser, Image as ImageIcon, Volume2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { getMyPhone, listContacts, saveMyPhone, type Contact } from "@/lib/chat";
import { Avatar } from "./Avatar";

// Local chat preferences (per device, like WhatsApp settings)
export function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    const raw = localStorage.getItem(`funtok:${key}`);
    if (raw !== null) setV(JSON.parse(raw) as T);
    const on = (e: Event) => { if ((e as CustomEvent).detail === key) { const r = localStorage.getItem(`funtok:${key}`); if (r !== null) setV(JSON.parse(r) as T); } };
    window.addEventListener("funtok-pref", on);
    return () => window.removeEventListener("funtok-pref", on);
  }, [key]);
  const set = (nv: T) => { localStorage.setItem(`funtok:${key}`, JSON.stringify(nv)); setV(nv); window.dispatchEvent(new CustomEvent("funtok-pref", { detail: key })); };
  return [v, set];
}

export const WALLPAPERS = [
  { id: "doodle", label: "Doodle", cls: "chat-wallpaper" },
  { id: "plain", label: "Dark", cls: "wall-plain" },
  { id: "green", label: "Green", cls: "wall-green" },
  { id: "purple", label: "Purple", cls: "wall-purple" },
  { id: "ocean", label: "Ocean", cls: "wall-ocean" },
  { id: "black", label: "Black", cls: "wall-black" },
] as const;
export const wallpaperClass = (id: string) => WALLPAPERS.find((w) => w.id === id)?.cls ?? "chat-wallpaper";

/** Short two-tone ping for incoming messages. */
export function playPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const now = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.18);
      o.connect(g).connect(ctx.destination); o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.2);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch { /* no audio */ }
}

export const textSizeClass = (s: string) => (s === "small" ? "text-xs" : s === "large" ? "text-base" : "text-sm");

const invite = async () => {
  const url = window.location.origin;
  const text = "Let's chat on Funtok! Join, save your number and add me:";
  if (navigator.share) { try { await navigator.share({ title: "Funtok", text, url }); } catch { /* cancelled */ } }
  else { await navigator.clipboard.writeText(`${text} ${url}`); toast.success("Invite link copied"); }
};

export function ChatMainMenu({ me, onNewChat }: { me: string; onNewChat: () => void }) {
  const [open, setOpen] = useState<null | "contacts" | "settings">(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="More" className="rounded-full p-2 hover:bg-secondary"><MoreVertical className="h-5 w-5" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onNewChat}><UserPlus className="mr-2 h-4 w-4" />New chat</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("contacts")}><Users className="mr-2 h-4 w-4" />Contacts</DropdownMenuItem>
          <DropdownMenuItem onClick={invite}><Share2 className="mr-2 h-4 w-4" />Invite a friend</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen("settings")}><Settings className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ContactsSheet me={me} open={open === "contacts"} onOpenChange={(o) => setOpen(o ? "contacts" : null)} />
      <SettingsSheet me={me} open={open === "settings"} onOpenChange={(o) => setOpen(o ? "settings" : null)} />
    </>
  );
}

function ContactsSheet({ me, open, onOpenChange }: { me: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [list, setList] = useState<Contact[]>([]);
  const navigate = useNavigate();
  useEffect(() => { if (open) listContacts(me).then(setList); }, [open, me]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-border bg-background sm:max-w-md">
        <SheetHeader><SheetTitle>Contacts ({list.length})</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-1 overflow-y-auto">
          {list.length === 0 && <p className="text-sm text-muted-foreground">No contacts yet. Use "New chat" to add a number.</p>}
          {list.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary">
              <Avatar name={c.name} size={44} />
              <button className="min-w-0 flex-1 text-left" onClick={() => { onOpenChange(false); navigate({ to: "/chat", search: { user: c.contact_user_id } }); }}>
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone}</p>
              </button>
              <button aria-label="Message" className="rounded-full p-2 text-primary" onClick={() => { onOpenChange(false); navigate({ to: "/chat", search: { user: c.contact_user_id } }); }}><MessageCircle className="h-5 w-5" /></button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ icon, title, sub, right, onClick }: { icon: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 px-1 py-3 ${onClick ? "cursor-pointer hover:bg-secondary/60" : ""}`}>
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p>{sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}</div>
      {right}
    </div>
  );
}

function SettingsSheet({ me, open, onOpenChange }: { me: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [notify, setNotify] = usePref("notify", true);
  const [online, setOnline] = usePref("showOnline", true);
  const [receipts, setReceipts] = usePref("readReceipts", true);
  const [size, setSize] = usePref("textSize", "medium");
  const [wall, setWall] = usePref("wallpaper", "doodle");
  const [sound, setSound] = usePref("notifySound", true);
  const [preview, setPreview] = usePref("notifyPreview", true);
  const [enterSend, setEnterSend] = usePref("enterSend", true);
  const [blocked, setBlocked] = usePref<string[]>("blocked", []);
  const [archived, setArchived] = usePref<string[]>("archived", []);
  const [blockedNames, setBlockedNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || !blocked.length) return;
    supabase.from("profiles").select("id,display_name,username").in("id", blocked).then(({ data }) =>
      setBlockedNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name ?? p.username]))));
  }, [open, blocked]);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("display_name,bio,avatar_url").eq("id", me).maybeSingle().then(({ data }) => {
      setName(data?.display_name ?? ""); setBio(data?.bio ?? ""); setAvatar(data?.avatar_url ?? null);
    });
    getMyPhone(me).then((p) => setPhone(p ?? ""));
  }, [open, me]);

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 50) || null, bio: bio.slice(0, 140) }).eq("id", me);
    if (error) toast.error(error.message); else { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  };
  const savePhone = async () => { try { await saveMyPhone(me, phone); toast.success("Number updated"); } catch (e) { toast.error((e as Error).message); } };
  const toggleNotify = async (v: boolean) => {
    if (v && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    setNotify(v);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-md">
        <SheetHeader><SheetTitle>Settings</SheetTitle></SheetHeader>
        <div className="mt-4 flex items-center gap-4">
          <Avatar url={avatar} name={name} size={64} />
          <div className="flex-1 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-lg bg-secondary px-3 py-2 text-sm outline-none" />
            <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="About (e.g. Hey there! I'm on Funtok)" className="w-full rounded-lg bg-secondary px-3 py-2 text-sm outline-none" />
          </div>
        </div>
        <button onClick={saveProfile} className="mt-2 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">Save profile</button>

        <p className="mt-6 text-xs font-semibold uppercase text-primary">Account</p>
        <Row icon={<Phone className="h-5 w-5" />} title="Phone number" sub="Friends add you with this number" />
        <div className="flex gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm outline-none" />
          <button onClick={savePhone} className="rounded-lg bg-secondary px-4 text-sm font-medium">Change</button>
        </div>
        <Row icon={<User className="h-5 w-5" />} title="My Fun Side profile" sub="Videos, followers and likes" onClick={() => { onOpenChange(false); navigate({ to: "/profile/$id", params: { id: me } }); }} />

        <p className="mt-6 text-xs font-semibold uppercase text-primary">Privacy</p>
        <Row icon={<Lock className="h-5 w-5" />} title="Show online & typing" sub="Others see when you're online" right={<Switch checked={online} onCheckedChange={setOnline} />} />
        <Row icon={<Lock className="h-5 w-5" />} title="Read receipts" sub="Mark chats as read when you open them" right={<Switch checked={receipts} onCheckedChange={setReceipts} />} />
        <Row icon={<Ban className="h-5 w-5" />} title="Blocked contacts" sub={blocked.length ? `${blocked.length} blocked` : "None"} />
        {blocked.map((id) => (
          <div key={id} className="flex items-center justify-between py-1 pl-10 text-sm">
            <span className="truncate">{blockedNames[id] ?? "Contact"}</span>
            <button onClick={() => setBlocked(blocked.filter((b) => b !== id))} className="rounded-lg bg-secondary px-3 py-1 text-xs">Unblock</button>
          </div>
        ))}

        <p className="mt-6 text-xs font-semibold uppercase text-primary">Chats</p>
        <Row icon={<Type className="h-5 w-5" />} title="Font size" right={
          <select value={size} onChange={(e) => setSize(e.target.value)} className="rounded-lg bg-secondary px-2 py-1 text-sm outline-none">
            <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
          </select>} />
        <Row icon={<ImageIcon className="h-5 w-5" />} title="Wallpaper" sub="Background behind your messages" />
        <div className="grid grid-cols-6 gap-2 pb-2">
          {WALLPAPERS.map((w) => (
            <button key={w.id} onClick={() => setWall(w.id)} aria-label={w.label} className={`aspect-[3/5] rounded-lg ${w.cls} ${wall === w.id ? "ring-2 ring-online" : "ring-1 ring-border"}`} />
          ))}
        </div>
        <Row icon={<Type className="h-5 w-5" />} title="Enter is send" sub="Enter key sends your message" right={<Switch checked={enterSend} onCheckedChange={setEnterSend} />} />
        <Row icon={<Archive className="h-5 w-5" />} title="Archived chats" sub={`${archived.length} archived`} right={archived.length ? <button onClick={() => { setArchived([]); toast.success("All chats unarchived"); }} className="rounded-lg bg-secondary px-3 py-1 text-xs">Unarchive all</button> : undefined} />

        <p className="mt-6 text-xs font-semibold uppercase text-primary">Notifications</p>
        <Row icon={<Bell className="h-5 w-5" />} title="Message notifications" sub="Alert when a new message arrives" right={<Switch checked={notify} onCheckedChange={toggleNotify} />} />
        <Row icon={<Volume2 className="h-5 w-5" />} title="Notification sound" sub="Play a tone for new messages" right={<Switch checked={sound} onCheckedChange={(v) => { setSound(v); if (v) playPing(); }} />} />
        <Row icon={<Info className="h-5 w-5" />} title="Show preview" sub="Show message text in alerts" right={<Switch checked={preview} onCheckedChange={setPreview} />} />

        <p className="mt-6 text-xs font-semibold uppercase text-primary">Help</p>
        <Row icon={<Share2 className="h-5 w-5" />} title="Invite a friend" sub="Share the Funtok link" onClick={invite} />
        <Row icon={<Info className="h-5 w-5" />} title="About Funtok" sub="Version 1.0 · Made in Kampala 🇺🇬" />
        <Row icon={<LogOut className="h-5 w-5 text-destructive" />} title="Log out" onClick={async () => { await supabase.auth.signOut(); onOpenChange(false); navigate({ to: "/" }); }} />
      </SheetContent>
    </Sheet>
  );
}

export function ThreadMenu({ me, cid, otherId, name, onChanged }: { me: string; cid: string; otherId: string; name?: string | undefined; onChanged: () => void }) {
  const navigate = useNavigate();
  const [muted, setMuted] = usePref<string[]>("muted", []);
  const isMuted = muted.includes(otherId);
  const [blocked, setBlocked] = usePref<string[]>("blocked", []);
  const [archived, setArchived] = usePref<string[]>("archived", []);
  const [cleared, setCleared] = usePref<Record<string, string>>("clearedAt", {});
  const isBlocked = blocked.includes(otherId);
  const isArchived = archived.includes(cid);
  const rename = async () => {
    const n = window.prompt("Contact name", name ?? "");
    if (!n?.trim()) return;
    const { data } = await supabase.from("contacts").update({ name: n.trim().slice(0, 60) }).eq("owner_id", me).eq("contact_user_id", otherId).select("id");
    if (!data?.length) {
      const phone = window.prompt("Their phone number (to save as contact)");
      if (!phone) return;
      const { error } = await supabase.from("contacts").insert({ owner_id: me, contact_user_id: otherId, name: n.trim(), phone });
      if (error) return void toast.error(error.message);
    }
    toast.success("Contact saved"); onChanged();
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${name ?? "this contact"} from your contacts?`)) return;
    await supabase.from("contacts").delete().eq("owner_id", me).eq("contact_user_id", otherId);
    toast.success("Contact deleted"); onChanged();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Chat options" className="rounded-full p-2.5 hover:bg-secondary"><MoreVertical className="h-5 w-5" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => navigate({ to: "/profile/$id", params: { id: otherId } })}><User className="mr-2 h-4 w-4" />View contact</DropdownMenuItem>
        <DropdownMenuItem onClick={rename}><Pencil className="mr-2 h-4 w-4" />Edit contact name</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setMuted(isMuted ? muted.filter((m) => m !== otherId) : [...muted, otherId]); toast.success(isMuted ? "Notifications on" : "Chat muted"); }}>
          {isMuted ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}{isMuted ? "Unmute notifications" : "Mute notifications"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setArchived(isArchived ? archived.filter((a) => a !== cid) : [...archived, cid]); toast.success(isArchived ? "Chat unarchived" : "Chat archived"); if (!isArchived) navigate({ to: "/chat" }); }}>
          <Archive className="mr-2 h-4 w-4" />{isArchived ? "Unarchive chat" : "Archive chat"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { if (!window.confirm("Clear all messages in this chat on this phone?")) return; setCleared({ ...cleared, [cid]: new Date().toISOString() }); toast.success("Chat cleared"); }}>
          <Eraser className="mr-2 h-4 w-4" />Clear chat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { if (!isBlocked && !window.confirm(`Block ${name ?? "this contact"}? You won't get their messages or alerts.`)) return; setBlocked(isBlocked ? blocked.filter((b) => b !== otherId) : [...blocked, otherId]); toast.success(isBlocked ? "Unblocked" : "Blocked"); }} className="text-destructive">
          <Ban className="mr-2 h-4 w-4" />{isBlocked ? "Unblock" : "Block"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={remove} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete contact</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
