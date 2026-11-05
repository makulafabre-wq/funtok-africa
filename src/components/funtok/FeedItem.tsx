import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircleMore, Share2, Send, Music2, Flame, Volume2, VolumeX, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFollow } from "@/hooks/use-follow";
import { Button } from "@/components/ui/button";
import { formatCount, playlistUrl, thumbUrl } from "@/lib/bunny";
import type { FeedVideo } from "@/lib/feed";
import { VideoPlayer } from "./VideoPlayer";
import { Avatar } from "./Avatar";
import { Caption } from "./Caption";
import { CommentsSheet } from "./CommentsSheet";
import { SendToChatSheet } from "./SendToChatSheet";

export function FeedItem({ video, active, prebuffer = false, muted, onToggleMute, rank }: { video: FeedVideo; active: boolean; prebuffer?: boolean; muted: boolean; onToggleMute: () => void; rank?: number | undefined }) {
  const { user } = useAuth();
  const follow = useFollow(video.user_id, user?.id);
  const likeBusy = useRef(false);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [heartBurst, setHeartBurst] = useState(false);
  useEffect(() => () => { if (heartTimer.current) clearTimeout(heartTimer.current); }, []);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes_count);
  const [pop, setPop] = useState(false);
  const [comments, setComments] = useState(false);
  const [send, setSend] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("likes").select("video_id").eq("video_id", video.id).eq("user_id", user.id).maybeSingle().then(({ data }) => setLiked(!!data));
  }, [user, video.id]);

  const toggleLike = async (onlyLike = false) => {
    if (!user) { toast("Sign in to like videos"); return; }
    if (likeBusy.current || (onlyLike && liked)) return;
    likeBusy.current = true;
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1)); setPop(true); setTimeout(() => setPop(false), 400);
    try {
    const res = next
      ? await supabase.from("likes").insert({ video_id: video.id, user_id: user.id })
      : await supabase.from("likes").delete().eq("video_id", video.id).eq("user_id", user.id);
    if (res.error) { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); }
    } catch { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); }
    finally { likeBusy.current = false; }
  };
  const doubleTapLike = () => {
    if (!user) { toast("Sign in to like videos"); return; }
    setHeartBurst(true);
    if (heartTimer.current) clearTimeout(heartTimer.current);
    heartTimer.current = setTimeout(() => setHeartBurst(false), 650);
    void toggleLike(true);
  };

  const share = async () => {
    const url = `${window.location.origin}/video/${video.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Funtok", text: video.caption, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      await supabase.rpc("record_share", { _video_id: video.id });
    } catch { /* cancelled */ }
  };

  const onWatch = (sec: number, pct: number) => {
    supabase.rpc("record_view", { _video_id: video.id, _watch_duration: sec, _watched_percent: pct }).then(() => {});
  };

  const p = video.profiles;
  const btn = "flex flex-col items-center gap-1 text-xs font-semibold text-shadow";

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <VideoPlayer src={playlistUrl(video.bunny_video_id)} poster={video.thumbnail_url || thumbUrl(video.bunny_video_id, 720)} active={active} prebuffer={prebuffer} muted={muted} onTap={onToggleMute} onDoubleTap={doubleTapLike} onWatch={onWatch} />
      <div className="pointer-events-none absolute inset-0 bg-scrim" />
      {heartBurst && <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><Heart className="h-24 w-24 fill-primary text-primary motion-safe:animate-heart" /></div>}

      <button onClick={onToggleMute} className="absolute left-3 top-24 rounded-full bg-overlay p-2" aria-label={muted ? "Unmute" : "Mute"}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {rank !== undefined && (
        <div className="absolute right-3 top-24 flex flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 font-display text-sm font-bold ${rank <= 3 ? "bg-primary text-primary-foreground shadow-glow" : "bg-overlay"}`}>#{rank}</span>
          <span className="flex items-center gap-1 rounded-full bg-overlay px-2 py-0.5 text-[11px]"><Flame className="h-3 w-3 text-primary" /> Score {formatCount(video.trending_score)}</span>
        </div>
      )}

      <div className="absolute bottom-6 right-2 flex flex-col items-center gap-5">
        <div className="relative mb-1">
          <Link to="/profile/$id" params={{ id: video.user_id }} aria-label={`View ${p?.username ?? "creator"} profile`}><Avatar url={p?.avatar_url} name={p?.username} size={46} ring /></Link>
          {!follow.ownProfile && !follow.following && <Button size="icon" onClick={follow.toggle} disabled={follow.pending} aria-label={`Follow ${p?.username ?? "creator"}`} title="Follow creator" className="absolute -bottom-2 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-background p-0"><Plus /></Button>}
        </div>
        <button onClick={() => void toggleLike()} className={btn} aria-label="Like" aria-pressed={liked}>
          <Heart className={`h-8 w-8 ${liked ? "fill-primary text-primary" : ""} ${pop ? "animate-heart" : ""}`} />
          {formatCount(likes)}
        </button>
        <button onClick={() => setComments(true)} className={btn} aria-label="Comments">
          <MessageCircleMore className="h-8 w-8" /> {formatCount(video.comments_count)}
        </button>
        <button onClick={share} className={btn} aria-label="Share">
          <Share2 className="h-7 w-7" /> {formatCount(video.shares_count)}
        </button>
        <button onClick={() => setSend(true)} className={btn} aria-label="Send to chat">
          <Send className="h-7 w-7" /> Chat
        </button>
      </div>

      <div className="absolute bottom-6 left-3 right-20 space-y-2 text-shadow">
        {video.is_trending && rank === undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground"><Flame className="h-3 w-3" /> Trending in Kampala</span>
        )}
        <Link to="/profile/$id" params={{ id: video.user_id }} className="block font-bold">@{p?.username ?? "funtok"}</Link>
        <Caption text={video.caption} />
        <p className="flex items-center gap-2 text-xs"><Music2 className="h-3.5 w-3.5 animate-spin-slow" /> original sound · {p?.username ?? "funtok"}{video.location ? ` · ${video.location}` : ""}</p>
      </div>

      <CommentsSheet videoId={video.id} open={comments} onOpenChange={setComments} allowComments={video.allow_comments} />
      <SendToChatSheet open={send} onOpenChange={setSend} bunnyVideoId={video.bunny_video_id} videoRowId={video.id} />
    </div>
  );
}
