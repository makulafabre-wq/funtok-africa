import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

const BURST = [{ dx: -70, r: -25 }, { dx: 60, r: 20 }, { dx: -30, r: -10 }, { dx: 35, r: 12 }, { dx: -90, r: -35 }, { dx: 85, r: 30 }];
import { Heart, MessageCircleMore, Share2, Send, Music2, Flame, Volume2, VolumeX, Plus, Download, Link2, UserRound, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFollow } from "@/hooks/use-follow";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { prepareVideoDownload, deliverVideo } from "@/lib/video-download";
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
  const [heartBurst, setHeartBurst] = useState(0);
  const [soundSheet, setSoundSheet] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);
  const navigate = useNavigate();
  const soundName = video.sound_name && video.sound_name !== "Original sound" ? video.sound_name : `original sound · ${video.profiles?.username ?? "funtok"}`;
  useEffect(() => () => { if (heartTimer.current) clearTimeout(heartTimer.current); }, []);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes_count);
  const [pop, setPop] = useState(false);
  const [comments, setComments] = useState(false);
  const [send, setSend] = useState(false);
  const [menu, setMenu] = useState(false);
  const [download, setDownload] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const downloadVideo = async () => {
    if (download) { await deliverVideo(download, `funtok-${video.id}.mp4`); return; }
    setPreparing(true);
    try { setDownload(await prepareVideoDownload(video.bunny_video_id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Download failed. Try again."); }
    finally { setPreparing(false); }
  };

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
    setHeartBurst((n) => n + 1);
    if (heartTimer.current) clearTimeout(heartTimer.current);
    heartTimer.current = setTimeout(() => setHeartBurst(0), 1300);
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
      <VideoPlayer src={playlistUrl(video.bunny_video_id)} poster={video.thumbnail_url || thumbUrl(video.bunny_video_id, 720)} active={active && !menu} prebuffer={prebuffer} muted={muted} tapToPause onLongPress={() => setMenu(true)} onDoubleTap={doubleTapLike} onWatch={onWatch} />
      <div className="pointer-events-none absolute inset-0 bg-scrim" />
      {heartBurst && <div key={heartBurst} className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <Heart className="h-24 w-24 fill-primary text-primary motion-safe:animate-heart" />
        {BURST.map((b, i) => <Heart key={i} style={{ "--dx": `${b.dx}px`, "--r": `${b.r}deg`, animationDelay: `${i * 60}ms` } as React.CSSProperties} className="absolute h-10 w-10 fill-primary text-primary opacity-0 motion-safe:animate-heart-float" />)}
      </div>}

      <button onClick={onToggleMute} className="absolute left-3 top-24 rounded-full bg-overlay p-2" aria-label={muted ? "Unmute" : "Mute"}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <Button variant="ghost" size="icon" aria-label="Video options" title="Video options" onClick={() => setMenu(true)} className="absolute left-3 top-36 rounded-full bg-overlay"><MoreHorizontal /></Button>

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
        <button onClick={() => setShareSheet(true)} className={btn} aria-label="Share">
          <Share2 className="h-7 w-7" /> {formatCount(video.shares_count)}
        </button>
        <button onClick={() => setSend(true)} className={btn} aria-label="Send to chat">
          <Send className="h-7 w-7" /> Chat
        </button>
        <button onClick={() => setSoundSheet(true)} aria-label="View sound" className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border-4 border-secondary bg-card animate-spin-slow">
          <Avatar url={p?.avatar_url} name={p?.username} size={26} />
        </button>
      </div>

      <div className="absolute bottom-6 left-3 right-20 space-y-2 text-shadow">
        {video.is_trending && rank === undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground"><Flame className="h-3 w-3" /> Trending in Kampala</span>
        )}
        <Link to="/profile/$id" params={{ id: video.user_id }} className="block font-bold">@{p?.username ?? "funtok"}</Link>
        <Caption text={video.caption} />
        <p onClick={() => setSoundSheet(true)} className="pointer-events-auto flex cursor-pointer items-center gap-2 text-xs"><Music2 className="h-3.5 w-3.5 animate-spin-slow" /> {soundName}{video.location ? ` · ${video.location}` : ""}</p>
      </div>

      <CommentsSheet videoId={video.id} open={comments} onOpenChange={setComments} allowComments={video.allow_comments} />
      <SendToChatSheet open={send} onOpenChange={setSend} bunnyVideoId={video.bunny_video_id} videoRowId={video.id} />
      <Sheet open={soundSheet} onOpenChange={setSoundSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Sound</SheetTitle>
          <div className="mx-auto flex max-w-lg items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-8 border-secondary bg-card animate-spin-slow"><Avatar url={p?.avatar_url} name={p?.username} size={40} /></div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 font-bold"><Music2 className="h-4 w-4 text-primary" /> <span className="truncate">{soundName}</span></p>
              <p className="text-sm text-muted-foreground">@{p?.username ?? "funtok"}{video.location ? ` · ${video.location}` : ""}</p>
            </div>
          </div>
          <Button className="mx-auto mt-5 flex w-full max-w-lg" onClick={() => { setSoundSheet(false); void navigate({ to: "/upload", search: { sound: soundName } }); }}><Music2 />Use this sound</Button>
        </SheetContent>
      </Sheet>
      <Sheet open={shareSheet} onOpenChange={setShareSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetTitle>Share to</SheetTitle>
          <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => { setShareSheet(false); setSend(true); }}><Send />Funtok chats</Button>
            <Button variant="secondary" onClick={() => { const url = `${window.location.origin}/video/${video.id}`; window.open(`https://wa.me/?text=${encodeURIComponent(`${video.caption ? video.caption + " " : ""}${url}`)}`, "_blank", "noopener"); void supabase.rpc("record_share", { _video_id: video.id }); setShareSheet(false); }}><MessageCircleMore />WhatsApp</Button>
            <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/video/${video.id}`).then(() => toast.success("Link copied")).catch(() => toast.error("Couldn't copy link")); }}><Link2 />Copy link</Button>
            <Button variant="secondary" onClick={() => { setShareSheet(false); void share(); }}><Share2 />More…</Button>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto" aria-describedby={undefined}>
          <SheetTitle>Video options</SheetTitle>
          <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-3">
            <Button variant="secondary" disabled={preparing} onClick={() => void downloadVideo()}><Download />{preparing ? "Preparing…" : download ? "Save video" : "Download video"}</Button>
            <Button variant="secondary" onClick={() => void share()}><Share2 />Share</Button>
            <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/video/${video.id}`).then(() => toast.success("Link copied")).catch(() => toast.error("Couldn't copy link")); }}><Link2 />Copy link</Button>
            <Button variant="secondary" onClick={() => { setMenu(false); setSend(true); }}><Send />Send to chat</Button>
            <Button variant="secondary" onClick={onToggleMute}>{muted ? <Volume2 /> : <VolumeX />}{muted ? "Unmute" : "Mute"}</Button>
            <Button variant="secondary" asChild><Link to="/profile/$id" params={{ id: video.user_id }}><UserRound />View creator</Link></Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
