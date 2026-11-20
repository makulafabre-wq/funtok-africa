import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Heart, MessageCircleMore, Share2, Send, Music2, Plus, Check, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { fetchAdSetup, trackAd, type HouseAd } from "@/lib/feed";
import { playlistUrl } from "@/lib/bunny";
import { hideNativeBanner, showNativeBanner } from "@/lib/ads";
import { VideoPlayer } from "./VideoPlayer";
import { Avatar } from "./Avatar";

const BURST = [
  { dx: -70, r: -25 },
  { dx: 60, r: 20 },
  { dx: -30, r: -10 },
  { dx: 35, r: 12 },
  { dx: -90, r: -35 },
  { dx: 85, r: 30 },
];

export function useAdSetup() {
  return useQuery({ queryKey: ["ad-setup"], queryFn: fetchAdSetup, staleTime: 5 * 60_000 });
}

function openAd(ad: HouseAd) {
  trackAd(ad.id, "click");
  if (ad.cta_link) {
    window.open(ad.cta_link, "_blank", "noopener,noreferrer");
  } else {
    toast.info("Opening sponsor website");
  }
}

/** Full-screen native video ad slot in the feed, styled 1:1 like TikTok sponsored posts. */
export function FeedAdCard({
  ad,
  active,
  muted = true,
  onToggleMute,
}: {
  ad: HouseAd | null;
  active: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(2450);
  const [pop, setPop] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const [following, setFollowing] = useState(false);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active && ad) trackAd(ad.id, "impression");
  }, [active, ad]);

  useEffect(() => () => {
    if (heartTimer.current) clearTimeout(heartTimer.current);
  }, []);

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    setPop(true);
    setTimeout(() => setPop(false), 400);
  };

  const doubleTapLike = () => {
    setHeartBurst((n) => n + 1);
    if (heartTimer.current) clearTimeout(heartTimer.current);
    heartTimer.current = setTimeout(() => setHeartBurst(0), 1300);
    if (!liked) toggleLike();
  };

  const toggleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !following;
    setFollowing(next);
    toast.success(next ? "Following sponsor" : "Unfollowed");
  };

  const handleShare = async () => {
    if (!ad) return;
    const url = ad.cta_link || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: ad.title, text: `Check out ${ad.title} on Funtok`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Ad link copied to clipboard");
      }
      trackAd(ad.id, "click");
    } catch {
      /* user cancelled */
    }
  };

  const btn = "flex flex-col items-center gap-1 text-xs font-semibold text-shadow";
  const brandName = ad?.title?.split(" ")[0]?.toLowerCase() || "sponsor";

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Background Video or Image */}
      {ad?.video_bunny_id ? (
        <VideoPlayer
          src={playlistUrl(ad.video_bunny_id)}
          poster={ad?.image_url ?? undefined}
          active={active}
          muted={muted}
          tapToPause
          onDoubleTap={doubleTapLike}
        />
      ) : ad?.image_url ? (
        <div className="relative h-full w-full cursor-pointer select-none" onClick={doubleTapLike}>
          <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-card to-background">
          <p className="font-display text-lg text-muted-foreground">Sponsored by {ad?.title ?? "Funtok"}</p>
        </div>
      )}

      {/* Scrim overlay */}
      <div className="pointer-events-none absolute inset-0 bg-scrim" />

      {/* Double tap heart burst */}
      {heartBurst > 0 && (
        <div key={heartBurst} className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <Heart className="h-24 w-24 fill-primary text-primary motion-safe:animate-heart" />
          {BURST.map((b, i) => (
            <Heart
              key={i}
              style={{
                "--dx": `${b.dx}px`,
                "--r": `${b.r}deg`,
                animationDelay: `${i * 60}ms`,
              } as React.CSSProperties}
              className="absolute h-10 w-10 fill-primary text-primary opacity-0 motion-safe:animate-heart-float"
            />
          ))}
        </div>
      )}

      {/* Top Left: Mute toggle */}
      {onToggleMute && (
        <button
          onClick={onToggleMute}
          className="absolute left-3 top-24 z-10 rounded-full bg-overlay p-2"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {/* Right Action Bar (TikTok Style) */}
      <div className="absolute bottom-6 right-2 z-10 flex flex-col items-center gap-5">
        {/* Brand Avatar with Follow button */}
        <div className="relative mb-1">
          <Avatar url={ad?.image_url ?? null} name={ad?.title ?? "Ad"} size={46} ring />
          <button
            onClick={toggleFollow}
            aria-label="Follow sponsor"
            className={`absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-background p-0 ${
              following ? "bg-muted text-foreground" : "bg-primary text-primary-foreground shadow-glow"
            }`}
          >
            {following ? <Check className="h-3 w-3" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Like */}
        <button onClick={toggleLike} className={btn} aria-label="Like" aria-pressed={liked}>
          <Heart className={`h-8 w-8 ${liked ? "fill-primary text-primary" : ""} ${pop ? "animate-heart" : ""}`} />
          {likes > 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
        </button>

        {/* Comments Indicator */}
        <button
          onClick={() => toast.info("Comments are turned off on sponsored videos")}
          className={btn}
          aria-label="Comments"
        >
          <MessageCircleMore className="h-8 w-8" />
          <span>Ad</span>
        </button>

        {/* Share */}
        <button onClick={handleShare} className={btn} aria-label="Share">
          <Share2 className="h-7 w-7" />
          <span>Share</span>
        </button>

        {/* Send to chat */}
        <button onClick={handleShare} className={btn} aria-label="Send to chat">
          <Send className="h-7 w-7" />
          <span>Chat</span>
        </button>

        {/* Spinning Sound Disc */}
        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border-4 border-secondary bg-card animate-spin-slow">
          <Music2 className="h-4 w-4 text-primary" />
        </div>
      </div>

      {/* Bottom Info Overlay */}
      <div className="absolute bottom-6 left-3 right-20 z-10 space-y-2 text-shadow">
        {/* Sponsored Indicator Tag */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
            Sponsored
          </span>
          <span className="text-[11px] font-medium text-white/80">Promoted</span>
        </div>

        {/* Brand Handle */}
        <p className="block font-bold text-white text-base">@{brandName}</p>

        {/* Caption */}
        <p className="text-sm font-medium leading-snug line-clamp-2 text-white/95">
          {ad?.title ?? "Check out this sponsored offer on Funtok"}
        </p>

        {/* Sound row */}
        <div className="flex items-center gap-2 text-xs text-white/80">
          <Music2 className="h-3.5 w-3.5 animate-spin-slow text-primary" />
          <span className="truncate">Promoted Sound · {ad?.title ?? "Funtok Sponsored"}</span>
        </div>

        {/* TikTok Style Interactive CTA Button */}
        <button
          onClick={() => ad && openAd(ad)}
          className="mt-2 flex w-full max-w-[280px] items-center justify-between rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition active:scale-95 hover:brightness-110"
        >
          <span>{ad?.cta_text || "Learn More"}</span>
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Bottom banner: real AdMob banner in the app, house banner on the web. */
export function BannerAd() {
  const { data } = useAdSetup();
  const [native, setNative] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let on = true;
    showNativeBanner(64).then((ok) => on && setNative(ok)).catch(() => {});
    return () => {
      on = false;
      hideNativeBanner();
    };
  }, []);
  const ad = data?.ads[0];
  useEffect(() => {
    if (ad && !native && !closed) trackAd(ad.id, "impression");
  }, [ad, native, closed]);
  if (native || closed || !data?.enabled || !ad) return null;
  return (
    <div className="relative z-20 flex items-center gap-3 border-t border-border bg-card px-3 py-2">
      <span className="rounded bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground">AD</span>
      <button onClick={() => openAd(ad)} className="flex-1 truncate text-left text-xs font-medium">
        {ad.title}
      </button>
      <button onClick={() => openAd(ad)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
        {ad.cta_text}
      </button>
      <button onClick={() => setClosed(true)} aria-label="Close ad" className="text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Stand-in for rewarded video boost (kept for video boost rewards). */
export function HouseAdOverlay({ seconds, title, onDone, onClose }: { seconds: number; title: string; onDone: () => void; onClose: () => void }) {
  const { data } = useAdSetup();
  const [left, setLeft] = useState(seconds);
  const ad = data?.ads[0];
  useEffect(() => {
    if (ad) trackAd(ad.id, "impression");
  }, [ad]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0) {
      if (!fired.current) {
        fired.current = true;
        doneRef.current();
      }
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{title}</span>
      <p className="font-display text-2xl font-bold">{ad?.title ?? "Advertise on Funtok"}</p>
      {ad && (
        <button onClick={() => openAd(ad)} className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">
          {ad.cta_text}
        </button>
      )}
      <button onClick={left <= 0 ? onClose : undefined} className="absolute right-4 top-4 rounded-full bg-secondary px-3 py-1 text-sm">
        {left > 0 ? `${left}s` : <X className="h-4 w-4" />}
      </button>
    </div>
  );
}
