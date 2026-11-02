import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, Shuffle, Swords, X, Loader2, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { Avatar } from "./Avatar";

type Room = Tables<"live_rooms">;
type Mini = { id: string; username: string; avatar_url: string | null };

const BATTLE_SECONDS = 180;

/** 🔥 Fire tab: hub for 1v1 Live Battles and Random Live matching. */
export function FireHub() {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [joining, setJoining] = useState<"battle" | "random" | null>(null);
  const [live, setLive] = useState<Room[]>([]);
  const [people, setPeople] = useState<Record<string, Mini>>({});

  useEffect(() => {
    const load = async (): Promise<void> => {
      const { data } = await supabase.from("live_rooms").select("*").eq("status", "live").eq("mode", "battle").order("started_at", { ascending: false }).limit(20);
      const rooms = data ?? [];
      setLive(rooms);
      const ids = [...new Set(rooms.flatMap((r) => [r.host_id, r.guest_id]).filter(Boolean) as string[])];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
        setPeople(Object.fromEntries((p ?? []).map((x) => [x.id, x])));
      }
    };
    void load();
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, []);

  const join = async (mode: "battle" | "random"): Promise<void> => {
    if (!user) { toast("Sign in to go live"); return; }
    setJoining(mode);
    const { data, error } = await supabase.rpc("join_live", { _mode: mode });
    setJoining(null);
    if (error || !data) { toast.error("Couldn't start live"); return; }
    setRoomId(data);
  };

  if (roomId || watching) {
    return <LiveRoom id={(roomId ?? watching)!} me={user?.id} viewer={!roomId}
      onLeave={() => { setRoomId(null); setWatching(null); }}
      onNext={async () => { const m = roomId; setRoomId(null); if (m) await supabase.rpc("leave_live", { _room: m }); void join("random"); }} />;
  }

  return (
    <div className="scrollbar-none h-full overflow-y-auto px-4 pb-8 pt-32">
      <div className="mb-5 flex items-center gap-2">
        <Flame className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl font-bold">Fire Live</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => void join("battle")} disabled={!!joining}
          className="flex flex-col items-start gap-2 rounded-2xl bg-gradient-brand p-4 text-left text-primary-foreground shadow-glow">
          {joining === "battle" ? <Loader2 className="h-7 w-7 animate-spin" /> : <Swords className="h-7 w-7" />}
          <span className="font-display text-lg font-bold">1v1 Battle</span>
          <span className="text-xs opacity-90">Face a creator. Viewers vote. 3 minutes.</span>
        </button>
        <button onClick={() => void join("random")} disabled={!!joining}
          className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left">
          {joining === "random" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Shuffle className="h-7 w-7 text-primary" />}
          <span className="font-display text-lg font-bold">Random Live</span>
          <span className="text-xs text-muted-foreground">Get matched with someone new. Skip any time.</span>
        </button>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">LIVE BATTLES NOW</h3>
      {live.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">No battles live right now. Start one!</p>
      ) : (
        <div className="space-y-2">
          {live.map((r) => {
            const a = people[r.host_id]; const b = r.guest_id ? people[r.guest_id] : undefined;
            return (
              <button key={r.id} onClick={() => setWatching(r.id)} className="flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left">
                <Avatar url={a?.avatar_url} name={a?.username} size={36} />
                <span className="font-display text-xs text-primary">VS</span>
                <Avatar url={b?.avatar_url} name={b?.username} size={36} />
                <span className="flex-1 truncate text-sm font-semibold">@{a?.username ?? "…"} vs @{b?.username ?? "…"}</span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">LIVE</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiveRoom({ id, me, viewer, onLeave, onNext }: { id: string; me: string | undefined; viewer: boolean; onLeave: () => void; onNext: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [people, setPeople] = useState<Record<string, Mini>>({});
  const [now, setNow] = useState(Date.now());
  const cam = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const { data } = await supabase.from("live_rooms").select("*").eq("id", id).maybeSingle();
      if (!data) return;
      setRoom(data);
      const ids = [data.host_id, data.guest_id].filter(Boolean) as string[];
      const { data: p } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
      setPeople(Object.fromEntries((p ?? []).map((x) => [x.id, x])));
    };
    void load();
    const ch = supabase.channel(`live-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${id}` }, () => void load())
      .subscribe();
    const poll = setInterval(() => void load(), 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { void supabase.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, [id]);

  useEffect(() => {
    if (viewer) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => { stream = s; if (cam.current) cam.current.srcObject = s; })
      .catch(() => toast("Allow camera access to show yourself"));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [viewer]);

  const leave = async (): Promise<void> => {
    if (!viewer) await supabase.rpc("leave_live", { _room: id });
    onLeave();
  };
  const vote = async (side: "host" | "guest"): Promise<void> => {
    if (!me) { toast("Sign in to vote"); return; }
    await supabase.rpc("vote_live", { _room: id, _side: side });
  };

  const host = room ? people[room.host_id] : undefined;
  const guest = room?.guest_id ? people[room.guest_id] : undefined;
  const waiting = room?.status === "waiting";
  const ended = room?.status === "ended";
  const isBattle = room?.mode === "battle";
  const left = room?.started_at ? Math.max(0, BATTLE_SECONDS - Math.floor((now - new Date(room.started_at).getTime()) / 1000)) : BATTLE_SECONDS;
  const total = (room?.host_votes ?? 0) + (room?.guest_votes ?? 0);
  const hostPct = total ? Math.round(((room?.host_votes ?? 0) / total) * 100) : 50;
  const iAmHost = me === room?.host_id;

  const Panel = ({ p, mine }: { p: Mini | undefined; mine: boolean }) => (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-card">
      {mine && !viewer ? <video ref={cam} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        : p ? <div className="flex flex-col items-center gap-2"><Avatar url={p.avatar_url} name={p.username} size={84} ring /><span className="text-xs text-muted-foreground">Camera connecting…</span></div>
        : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="text-sm">Finding a match…</span></div>}
      {p && <span className="absolute bottom-2 left-2 rounded-full bg-overlay px-2 py-0.5 text-xs font-semibold">@{p.username}</span>}
    </div>
  );

  return (
    <div className="flex h-full flex-col pt-28">
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          {isBattle ? <Swords className="h-3.5 w-3.5" /> : <Shuffle className="h-3.5 w-3.5" />}
          {waiting ? "WAITING" : ended ? "ENDED" : "LIVE"}
        </span>
        {isBattle && !waiting && !ended && <span className="font-display text-sm">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
        <button onClick={() => void leave()} className="rounded-full bg-overlay p-2" aria-label="Leave live"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <Panel p={host} mine={iAmHost} />
        <Panel p={guest} mine={!iAmHost && me === room?.guest_id} />
      </div>

      {isBattle && !waiting && (
        <div className="space-y-2 p-3">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="bg-primary transition-all" style={{ width: `${hostPct}%` }} />
            <div className="flex-1 bg-accent" />
          </div>
          <div className="flex justify-between text-xs font-semibold"><span>{room?.host_votes ?? 0} 🔥</span><span>🔥 {room?.guest_votes ?? 0}</span></div>
          {ended || left === 0 ? (
            <p className="text-center font-display text-lg">{total === 0 ? "Draw" : `@${(hostPct >= 50 ? host : guest)?.username ?? "?"} wins! 🏆`}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => void vote("host")} className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">🔥 @{host?.username ?? "host"}</button>
              <button onClick={() => void vote("guest")} className="rounded-xl bg-accent py-2.5 text-sm font-bold text-accent-foreground">🔥 @{guest?.username ?? "guest"}</button>
            </div>
          )}
        </div>
      )}
      {!isBattle && !viewer && (
        <div className="flex gap-2 p-3">
          {guest && room && <Link to="/profile/$id" params={{ id: iAmHost ? room.guest_id! : room.host_id }} className="flex-1 rounded-xl border border-border py-2.5 text-center text-sm font-semibold">View profile</Link>}
          <button onClick={onNext} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"><SkipForward className="h-4 w-4" /> Next</button>
        </div>
      )}
    </div>
  );
}
