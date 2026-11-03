import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar } from "./Avatar";
import { GROUP_LIVE_CAPACITY } from "@/lib/group-live";
import type { Json } from "@/integrations/supabase/types";

type Member = { user_id: string; seat: number; username: string; avatar_url: string | null };
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

function StreamVideo({ stream, mine }: { stream: MediaStream; mine: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => undefined); } }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={mine} className={`h-full w-full object-cover ${mine ? "-scale-x-100" : ""}`} />;
}

export function GroupLive({ id, me, onLeave }: { id: string; me: string; onLeave: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [error, setError] = useState("");
  const local = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const peers = new Map<string, RTCPeerConnection>();
    const candidates = new Map<string, RTCIceCandidateInit[]>();
    const send = async (recipient: string, payload: Signal) => {
      if (cancelled) return;
      const { error: failure } = await supabase.from("group_live_signals").insert({
        room_id: id, sender_id: me, recipient_id: recipient, payload: JSON.parse(JSON.stringify(payload)) as Json,
      });
      if (failure && !cancelled) setError("Live connection interrupted. Leave and rejoin to retry.");
    };
    const connect = (uid: string) => {
      const existing = peers.get(uid);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peers.set(uid, pc);
      local.current?.getTracks().forEach((track) => { if (local.current) pc.addTrack(track, local.current); });
      pc.onicecandidate = (event) => { if (event.candidate) void send(uid, { candidate: event.candidate.toJSON() }); };
      pc.ontrack = (event) => {
        const media = event.streams[0];
        if (media && !cancelled) setStreams((old) => ({ ...old, [uid]: media }));
      };
      pc.onconnectionstatechange = () => {
        if (!cancelled && pc.connectionState === "failed") setError("A camera could not connect on this network. Try a different Wi-Fi or mobile connection.");
      };
      return pc;
    };
    const poll = async () => {
      try {
        const { data, error: memberError } = await supabase.from("group_live_members").select("user_id,seat").eq("room_id", id).gt("heartbeat_at", new Date(Date.now() - 45000).toISOString()).order("seat");
        if (cancelled) return;
        if (memberError) throw memberError;
        const rows = data ?? [];
        if (!rows.some((row) => row.user_id === me)) { setError("Your live session expired. Leave and rejoin."); return; }
        const { data: profiles } = await supabase.from("profiles").select("id,username,avatar_url").in("id", rows.map((row) => row.user_id));
        if (cancelled) return;
        setMembers(rows.map((row) => {
          const profile = profiles?.find((p) => p.id === row.user_id);
          return { ...row, username: profile?.username ?? "Creator", avatar_url: profile?.avatar_url ?? null };
        }));
        for (const [uid, pc] of peers) {
          if (!rows.some((row) => row.user_id === uid)) {
            pc.close(); peers.delete(uid); candidates.delete(uid);
            setStreams((old) => { const next = { ...old }; delete next[uid]; return next; });
          }
        }
        for (const row of rows) {
          if (row.user_id === me || peers.has(row.user_id)) continue;
          const pc = connect(row.user_id);
          if (me < row.user_id) {
            await pc.setLocalDescription(await pc.createOffer());
            if (pc.localDescription) await send(row.user_id, { description: pc.localDescription.toJSON() });
          }
        }
        const { data: signals, error: signalError } = await supabase.from("group_live_signals").select("id,sender_id,payload").eq("room_id", id).eq("recipient_id", me).order("id").limit(100);
        if (signalError) throw signalError;
        for (const row of signals ?? []) {
          if (cancelled) return;
          if (!rows.some((member) => member.user_id === row.sender_id)) continue;
          const payload = row.payload as Signal;
          const pc = connect(row.sender_id);
          try {
            if (payload.description) {
              await pc.setRemoteDescription(payload.description);
              for (const ice of candidates.get(row.sender_id) ?? []) await pc.addIceCandidate(ice);
              candidates.delete(row.sender_id);
              if (payload.description.type === "offer") {
                await pc.setLocalDescription(await pc.createAnswer());
                if (pc.localDescription) await send(row.sender_id, { description: pc.localDescription.toJSON() });
              }
            } else if (payload.candidate) {
              if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
              else candidates.set(row.sender_id, [...(candidates.get(row.sender_id) ?? []), payload.candidate]);
            }
          } catch { if (!cancelled) setError("A live camera could not connect. Leave and rejoin to retry."); }
          await supabase.from("group_live_signals").delete().eq("id", row.id);
        }
      } catch { if (!cancelled) setError("Could not refresh the live room. Check your connection."); }
      if (!cancelled) timer = setTimeout(() => void poll(), 1500);
    };
    const start = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 480 }, height: { ideal: 640 }, frameRate: { ideal: 15 } }, audio: true });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        local.current = media;
        setStreams({ [me]: media });
        heartbeat = setInterval(() => { void supabase.rpc("heartbeat_group_live", { _room: id }); }, 10000);
        void poll();
      } catch { if (!cancelled) { setError("Allow camera and microphone access, then leave and rejoin."); void supabase.rpc("leave_group_live", { _room: id }); } }
    };
    void start();
    return () => {
      cancelled = true; clearTimeout(timer); clearInterval(heartbeat);
      peers.forEach((pc) => pc.close());
      local.current?.getTracks().forEach((track) => track.stop());
      void supabase.rpc("leave_group_live", { _room: id });
    };
  }, [id, me]);

  return (
    <div className="flex h-full flex-col gap-2 px-3 pb-3 pt-28">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" /> Six-person Live · {members.length}/{GROUP_LIVE_CAPACITY}</span>
        <Button variant="ghost" size="icon" aria-label="Leave group live" onClick={onLeave}><X /></Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2">
        {Array.from({ length: GROUP_LIVE_CAPACITY }, (_, i) => {
          const member = members.find((p) => p.seat === i + 1);
          const media = member ? streams[member.user_id] : undefined;
          return <div key={i} className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-card">
            {media ? <StreamVideo stream={media} mine={member?.user_id === me} /> : member ? <Avatar name={member.username} url={member.avatar_url} size={48} /> : <Users className="h-8 w-8 text-muted-foreground" />}
            <span className="absolute inset-x-0 bottom-0 truncate bg-overlay px-2 py-1 text-xs">{member ? `@${member.username}${member.user_id === me ? " · You" : ""}` : "Open seat"}</span>
          </div>;
        })}
      </div>
      <div className="flex justify-center gap-3">
        <Button variant={mic ? "secondary" : "destructive"} size="icon" aria-label={mic ? "Mute microphone" : "Unmute microphone"} onClick={() => { local.current?.getAudioTracks().forEach((track) => { track.enabled = !mic; }); setMic(!mic); }}>{mic ? <Mic /> : <MicOff />}</Button>
        <Button variant={camera ? "secondary" : "destructive"} size="icon" aria-label={camera ? "Turn camera off" : "Turn camera on"} onClick={() => { local.current?.getVideoTracks().forEach((track) => { track.enabled = !camera; }); setCamera(!camera); }}>{camera ? <Camera /> : <CameraOff />}</Button>
      </div>
    </div>
  );
}

export function GroupLiveHub({ me }: { me: string | undefined }) {
  const [active, setActive] = useState<string | null>(null);
  const [rooms, setRooms] = useState<{ id: string; count: number }[]>([]);
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    if (!me) return;
    const load = async () => {
      const { data } = await supabase.from("group_live_members").select("room_id").gt("heartbeat_at", new Date(Date.now() - 45000).toISOString());
      const counts = new Map<string, number>();
      data?.forEach((row) => counts.set(row.room_id, (counts.get(row.room_id) ?? 0) + 1));
      setRooms(Array.from(counts, ([id, count]) => ({ id, count })));
    };
    void load(); const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [me]);
  const join = async (id?: string) => {
    if (!me) { toast("Sign in to go live"); return; }
    setJoining(true);
    const { data, error } = await supabase.rpc("join_group_live", id ? { _room: id } : {});
    setJoining(false);
    if (error || !data) { toast.error(error?.message ?? "Could not join live"); return; }
    setActive(data);
  };
  return <>
    <Button disabled={joining} className="mt-3 w-full" size="lg" onClick={() => void join()}><Users /> Six-person Live</Button>
    {rooms.map((room) => <div key={room.id} className="mt-2 flex items-center justify-between border-b border-border py-3 text-sm"><span>Group Live · {room.count}/6</span><Button size="sm" variant="secondary" disabled={joining || room.count >= GROUP_LIVE_CAPACITY} onClick={() => void join(room.id)}>{room.count >= GROUP_LIVE_CAPACITY ? "Full" : "Join"}</Button></div>)}
    {active && me && <div className="absolute inset-0 z-10 bg-background"><GroupLive id={active} me={me} onLeave={() => setActive(null)} /></div>}
  </>;
}