import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  Flame,
  Shuffle,
  Swords,
  X,
  Loader2,
  SkipForward,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  SwitchCamera,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { Avatar } from "./Avatar";
import { GroupLiveHub } from "./GroupLive";

type Room = Tables<"live_rooms">;
type Mini = { id: string; username: string; avatar_url: string | null };

const BATTLE_SECONDS = 180;
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function FireHub() {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [joining, setJoining] = useState<"battle" | "random" | null>(null);
  const [live, setLive] = useState<Room[]>([]);
  const [people, setPeople] = useState<Record<string, Mini>>({});

  useEffect(() => {
    const load = async (): Promise<void> => {
      const { data } = await supabase
        .from("live_rooms")
        .select("*")
        .eq("status", "live")
        .eq("mode", "battle")
        .order("started_at", { ascending: false })
        .limit(20);
      const rooms = data ?? [];
      setLive(rooms);
      const ids = [
        ...new Set(
          rooms.flatMap((r) => [r.host_id, r.guest_id]).filter(Boolean) as string[]
        ),
      ];
      if (ids.length) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ids);
        setPeople(Object.fromEntries((p ?? []).map((x) => [x.id, x])));
      }
    };
    void load();
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, []);

  const join = async (mode: "battle" | "random"): Promise<void> => {
    if (!user) {
      toast("Sign in to go live");
      return;
    }
    setJoining(mode);
    const { data, error } = await supabase.rpc("join_live", { _mode: mode });
    setJoining(null);
    if (error || !data) {
      toast.error("Couldn't start live");
      return;
    }
    setRoomId(data);
  };

  const activeRoom = roomId ?? watching;
  if (activeRoom) {
    return (
      <LiveRoom
        id={activeRoom}
        me={user?.id}
        viewer={!roomId}
        onLeave={() => {
          setRoomId(null);
          setWatching(null);
        }}
        onNext={async () => {
          const m = roomId;
          setRoomId(null);
          if (m) await supabase.rpc("leave_live", { _room: m });
          void join("random");
        }}
      />
    );
  }

  return (
    <div className="scrollbar-none h-full overflow-y-auto px-4 pb-8 pt-32">
      <div className="mb-5 flex items-center gap-2">
        <Flame className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl font-bold">Fire Live</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => void join("battle")}
          disabled={!!joining}
          className="flex flex-col items-start gap-2 rounded-2xl bg-gradient-brand p-4 text-left text-primary-foreground shadow-glow transition-transform active:scale-95"
        >
          {joining === "battle" ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Swords className="h-7 w-7" />
          )}
          <span className="font-display text-lg font-bold">1v1 Battle</span>
          <span className="text-xs opacity-90">Face a creator. Viewers vote. 3 minutes.</span>
        </button>
        <button
          onClick={() => void join("random")}
          disabled={!!joining}
          className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-transform active:scale-95"
        >
          {joining === "random" ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : (
            <Shuffle className="h-7 w-7 text-primary" />
          )}
          <span className="font-display text-lg font-bold">Random Live</span>
          <span className="text-xs text-muted-foreground">Get matched with someone new. Skip any time.</span>
        </button>
      </div>

      <GroupLiveHub me={user?.id} />

      <h3 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">LIVE BATTLES NOW</h3>
      {live.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">
          No battles live right now. Start one!
        </p>
      ) : (
        <div className="space-y-2">
          {live.map((r) => {
            const a = people[r.host_id];
            const b = r.guest_id ? people[r.guest_id] : undefined;
            return (
              <button
                key={r.id}
                onClick={() => setWatching(r.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left transition-colors hover:bg-secondary/60"
              >
                <Avatar url={a?.avatar_url} name={a?.username} size={36} />
                <span className="font-display text-xs text-primary">VS</span>
                <Avatar url={b?.avatar_url} name={b?.username} size={36} />
                <span className="flex-1 truncate text-sm font-semibold">
                  @{a?.username ?? "…"} vs @{b?.username ?? "…"}
                </span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  LIVE
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiveRoom({
  id,
  me,
  viewer,
  onLeave,
  onNext,
}: {
  id: string;
  me: string | undefined;
  viewer: boolean;
  onLeave: () => void;
  onNext: () => void;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [people, setPeople] = useState<Record<string, Mini>>({});
  const [now, setNow] = useState(Date.now());

  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [remoteStreamAttached, setRemoteStreamAttached] = useState(false);

  const localCamRef = useRef<HTMLVideoElement>(null);
  const remoteCamRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    pendingCandidates.current = [];
    setRemoteStreamAttached(false);
  }, []);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const { data } = await supabase.from("live_rooms").select("*").eq("id", id).maybeSingle();
      if (!data) return;
      setRoom(data);
      const ids = [data.host_id, data.guest_id].filter(Boolean) as string[];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
        setPeople(Object.fromEntries((p ?? []).map((x) => [x.id, x])));
      }
    };
    void load();
    const ch = supabase
      .channel(`live-db-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${id}` }, () => void load())
      .subscribe();
    const poll = setInterval(() => void load(), 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [id]);

  useEffect(() => {
    if (viewer) return;
    let cancelled = false;

    const startLocalMedia = async () => {
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localCamRef.current) {
          localCamRef.current.srcObject = stream;
        }

        if (peerRef.current) {
          const senders = peerRef.current.getSenders();
          stream.getTracks().forEach((track) => {
            const sender = senders.find((s) => s.track?.kind === track.kind);
            if (sender) {
              void sender.replaceTrack(track);
            } else {
              peerRef.current?.addTrack(track, stream);
            }
          });
        }
      } catch (err) {
        console.warn("Could not capture camera/mic:", err);
        toast("Enable camera & microphone permissions to stream");
      }
    };

    void startLocalMedia();

    return () => {
      cancelled = true;
    };
  }, [viewer, facingMode]);

  useEffect(() => {
    if (viewer || !me || !room || room.status !== "live" || !room.host_id || !room.guest_id) {
      return;
    }

    const isHost = me === room.host_id;
    const targetPeerId = isHost ? room.guest_id : room.host_id;
    let pc: RTCPeerConnection | null = new RTCPeerConnection(RTC_CONFIG);
    peerRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        if (pc && localStreamRef.current) {
          pc.addTrack(t, localStreamRef.current);
        }
      });
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteCamRef.current && remoteStream) {
        remoteCamRef.current.srcObject = remoteStream;
        setRemoteStreamAttached(true);
      }
    };

    const channel = supabase.channel(`webrtc-${id}`, {
      config: { broadcast: { self: false } },
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void channel.send({
          type: "broadcast",
          event: "signal",
          payload: { from: me, to: targetPeerId, candidate: event.candidate.toJSON() },
        });
      }
    };

    channel
      .on("broadcast", { event: "signal" }, async (msg) => {
        const { from, to, sdp, candidate } = msg.payload || {};
        if (to !== me || from !== targetPeerId || !pc) return;

        try {
          if (sdp) {
            if (sdp.type === "offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              while (pendingCandidates.current.length) {
                const cand = pendingCandidates.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              void channel.send({
                type: "broadcast",
                event: "signal",
                payload: { from: me, to: targetPeerId, sdp: answer },
              });
            } else if (sdp.type === "answer") {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              while (pendingCandidates.current.length) {
                const cand = pendingCandidates.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
            }
          } else if (candidate) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              pendingCandidates.current.push(candidate);
            }
          }
        } catch (e) {
          console.warn("WebRTC signaling error:", e);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && isHost && pc) {
          setTimeout(async () => {
            if (!pc || pc.signalingState === "closed") return;
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              void channel.send({
                type: "broadcast",
                event: "signal",
                payload: { from: me, to: targetPeerId, sdp: offer },
              });
            } catch (err) {
              console.warn("Could not create offer:", err);
            }
          }, 800);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      if (pc) {
        pc.close();
        peerRef.current = null;
      }
      setRemoteStreamAttached(false);
    };
  }, [id, me, viewer, room?.status, room?.host_id, room?.guest_id]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !micEnabled));
      setMicEnabled((prev) => !prev);
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !camEnabled));
      setCamEnabled((prev) => !prev);
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const leave = async (): Promise<void> => {
    cleanupMedia();
    if (!viewer) await supabase.rpc("leave_live", { _room: id });
    onLeave();
  };

  const vote = async (side: "host" | "guest"): Promise<void> => {
    if (!me) {
      toast("Sign in to vote");
      return;
    }
    await supabase.rpc("vote_live", { _room: id, _side: side });
    toast.success("Vote counted!");
  };

  const host = room ? people[room.host_id] : undefined;
  const guest = room?.guest_id ? people[room.guest_id] : undefined;
  const waiting = room?.status === "waiting";
  const ended = room?.status === "ended";
  const isBattle = room?.mode === "battle";
  const left = room?.started_at
    ? Math.max(0, BATTLE_SECONDS - Math.floor((now - new Date(room.started_at).getTime()) / 1000))
    : BATTLE_SECONDS;
  const total = (room?.host_votes ?? 0) + (room?.guest_votes ?? 0);
  const hostPct = total ? Math.round(((room?.host_votes ?? 0) / total) * 100) : 50;
  const iAmHost = me === room?.host_id;

  const Panel = ({
    p,
    mine,
    videoRef,
    isStreamAttached,
  }: {
    p: Mini | undefined;
    mine: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isStreamAttached: boolean;
  }) => (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-950">
      {mine && !viewer ? (
        <>
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
          />
          {!camEnabled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-muted-foreground">
              <VideoOff className="h-10 w-10 mb-2" />
              <span className="text-sm font-medium">Camera is off</span>
            </div>
          )}
        </>
      ) : isStreamAttached ? (
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
      ) : p ? (
        <div className="flex flex-col items-center gap-3">
          <Avatar url={p.avatar_url} name={p.username} size={84} ring />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Connecting live video…</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <span className="text-sm font-medium">Finding a match…</span>
        </div>
      )}

      {p && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
          <span>@{p.username}</span>
          {mine && <span className="text-[10px] text-primary">(You)</span>}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
            {isBattle ? <Swords className="h-3.5 w-3.5" /> : <Shuffle className="h-3.5 w-3.5" />}
            {waiting ? "WAITING" : ended ? "ENDED" : "LIVE"}
          </span>
          {isBattle && !waiting && !ended && (
            <span className="rounded-full bg-black/60 px-2.5 py-1 font-display text-xs font-bold text-white backdrop-blur-md">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!viewer && (
            <>
              <button
                onClick={flipCamera}
                className="rounded-full bg-black/60 p-2 text-white backdrop-blur-md active:scale-95"
                aria-label="Flip camera"
              >
                <SwitchCamera className="h-4 w-4" />
              </button>
              <button
                onClick={toggleMic}
                className={`rounded-full p-2 backdrop-blur-md active:scale-95 ${
                  micEnabled ? "bg-black/60 text-white" : "bg-red-600 text-white"
                }`}
                aria-label="Toggle microphone"
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              <button
                onClick={toggleCam}
                className={`rounded-full p-2 backdrop-blur-md active:scale-95 ${
                  camEnabled ? "bg-black/60 text-white" : "bg-red-600 text-white"
                }`}
                aria-label="Toggle camera"
              >
                {camEnabled ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
            </>
          )}
          <button
            onClick={() => void leave()}
            className="rounded-full bg-black/60 p-2 text-white backdrop-blur-md active:scale-95"
            aria-label="Leave live"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5">
        <Panel
          p={host}
          mine={iAmHost}
          videoRef={iAmHost ? localCamRef : remoteCamRef}
          isStreamAttached={!iAmHost && remoteStreamAttached}
        />
        <Panel
          p={guest}
          mine={!iAmHost && me === room?.guest_id}
          videoRef={!iAmHost && me === room?.guest_id ? localCamRef : remoteCamRef}
          isStreamAttached={iAmHost && remoteStreamAttached}
        />
      </div>

      {isBattle && !waiting && (
        <div className="absolute inset-x-0 bottom-0 z-20 space-y-2 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-primary transition-all duration-300" style={{ width: `${hostPct}%` }} />
            <div className="flex-1 bg-accent transition-all duration-300" />
          </div>
          <div className="flex justify-between text-xs font-semibold text-white">
            <span>{room?.host_votes ?? 0} 🔥</span>
            <span>🔥 {room?.guest_votes ?? 0}</span>
          </div>
          {ended || left === 0 ? (
            <p className="text-center font-display text-lg font-bold text-white">
              {total === 0 ? "Draw" : `@${(hostPct >= 50 ? host : guest)?.username ?? "?"} wins! 🏆`}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void vote("host")}
                className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95"
              >
                🔥 Vote @{host?.username ?? "host"}
              </button>
              <button
                onClick={() => void vote("guest")}
                className="rounded-xl bg-accent py-2.5 text-sm font-bold text-accent-foreground active:scale-95"
              >
                🔥 Vote @{guest?.username ?? "guest"}
              </button>
            </div>
          )}
        </div>
      )}

      {!isBattle && !viewer && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {guest && room?.guest_id && (
            <Link
              to="/profile/$id"
              params={{ id: iAmHost ? room.guest_id : room.host_id }}
              className="flex-1 rounded-xl border border-zinc-700 bg-black/60 py-2.5 text-center text-sm font-semibold text-white backdrop-blur-md active:scale-95"
            >
              View profile
            </Link>
          )}
          <button
            onClick={() => {
              toast("User reported to moderators.");
            }}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white backdrop-blur-md active:scale-95"
            title="Report"
          >
            <Flag className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              cleanupMedia();
              onNext();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95"
          >
            <SkipForward className="h-4 w-4" /> Next
          </button>
        </div>
      )}
    </div>
  );
}
