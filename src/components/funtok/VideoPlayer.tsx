import { useEffect, useRef, useState } from "react";
import { loadHls } from "@/lib/hls-loader";
import { Video, Play } from "lucide-react";
import { cacheMedia, cachedMediaUrl, offlineVideoUrl } from "@/lib/offline-cache";
import { useOnline } from "@/hooks/use-online";

type Props = {
  src: string;
  poster?: string;
  active: boolean;
  prebuffer?: boolean;
  cacheOffline?: boolean;
  muted: boolean;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  tapToPause?: boolean;
  onWatch?: (seconds: number, percent: number) => void;
  className?: string;
};

export function VideoPlayer({
  src,
  poster,
  active,
  prebuffer = false,
  cacheOffline = false,
  muted,
  onTap,
  onDoubleTap,
  onLongPress,
  tapToPause = false,
  onWatch,
  className,
}: Props) {
  const online = useOnline();
  const [offlineMissing, setOfflineMissing] = useState(false);
  const [savedPoster, setSavedPoster] = useState<string>();
  const [buffering, setBuffering] = useState(false);

  useEffect(() => {
    if (!cacheOffline || !online || (!active && !prebuffer)) return;
    const mp4 = offlineVideoUrl(src);
    if (mp4) void cacheMedia(mp4, "video");
    if (poster) void cacheMedia(poster, "image");
  }, [src, poster, active, prebuffer, online, cacheOffline]);

  useEffect(() => {
    if (!poster || online) {
      setSavedPoster(undefined);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    void cachedMediaUrl(poster).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setSavedPoster(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [poster, online]);

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(() => () => clearHold(), []);

  const singleTap = () => {
    if (!tapToPause) {
      onTap?.();
      return;
    }
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (pausedRef.current) ref.current?.pause();
    else if (activeRef.current) void ref.current?.play().catch(() => undefined);
  };

  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = null;
    },
    [active]
  );

  const handleTap = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!onDoubleTap) {
      singleTap();
      return;
    }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoubleTap();
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        singleTap();
      }, 280);
    }
  };

  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const activeRef = useRef(active);
  const bufferRef = useRef(active || prebuffer);
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  activeRef.current = active;
  bufferRef.current = active || prebuffer;
  const watchRef = useRef(onWatch);
  watchRef.current = onWatch;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPlaying(false);
    setBuffering(active);
    setPosterFailed(false);
    setOfflineMissing(false);
    let cancelled = false;
    let objectUrl: string | undefined;

    const playWhenReady = () => {
      if (activeRef.current && !pausedRef.current) {
        void el.play().catch(() => undefined);
      }
    };

    el.addEventListener("loadeddata", playWhenReady);
    if (!online) {
      const mp4 = offlineVideoUrl(src);
      void cachedMediaUrl(mp4 ?? src).then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          setOfflineMissing(true);
          setBuffering(false);
          return;
        }
        objectUrl = url;
        el.src = url;
        el.load();
        playWhenReady();
      });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
    } else {
      loadHls()
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (Hls.isSupported()) {
            const h = new Hls({ autoStartLoad: false, maxBufferLength: 8, maxMaxBufferLength: 12, backBufferLength: 2 });
            hlsRef.current = h;
            h.loadSource(src);
            h.attachMedia(el);
            h.on(Hls.Events.MANIFEST_PARSED, () => {
              if (bufferRef.current) h.startLoad();
              playWhenReady();
            });
          } else {
            el.src = src;
          }
        })
        .catch(() => {
          if (!cancelled) el.src = src;
        });
    }

    return () => {
      cancelled = true;
      el.removeEventListener("loadeddata", playWhenReady);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      el.pause();
      el.removeAttribute("src");
      el.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, online]);

  useEffect(() => {
    if (active || prebuffer) hlsRef.current?.startLoad();
    else hlsRef.current?.stopLoad();
  }, [active, prebuffer]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pausedRef.current = false;
    setPaused(false);
    if (active) {
      setBuffering(true);
      el.play().catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
      setBuffering(false);
    }
  }, [active, src]);

  useEffect(() => {
    if (!active || !online) return;
    const el = ref.current;
    if (!el) return;
    let watched = 0;
    let maxPct = 0;
    let last = el.currentTime;
    const onTime = () => {
      const t = el.currentTime;
      const d = el.duration || 0;
      if (t > last && t - last < 2) watched += t - last;
      if (t < last) maxPct = 100;
      last = t;
      if (d) maxPct = Math.max(maxPct, (t / d) * 100);
    };
    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      if (watched > 1) watchRef.current?.(watched, Math.min(100, maxPct));
    };
  }, [active, online]);

  return (
    <div
      className="touch-manipulation relative h-full w-full select-none overflow-hidden bg-black"
      onClick={handleTap}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        clearHold();
        suppressClick.current = false;
        startPoint.current = { x: event.clientX, y: event.clientY };
        if (onLongPress) {
          holdTimer.current = setTimeout(() => {
            suppressClick.current = true;
            if (tapTimer.current) clearTimeout(tapTimer.current);
            tapTimer.current = null;
            onLongPress();
          }, 550);
        }
      }}
      onPointerMove={(event) => {
        if (Math.hypot(event.clientX - startPoint.current.x, event.clientY - startPoint.current.y) > 12) {
          clearHold();
          suppressClick.current = true;
        }
      }}
      onPointerUp={clearHold}
      onPointerCancel={() => {
        clearHold();
        suppressClick.current = true;
      }}
      onContextMenu={(event) => {
        if (onLongPress) {
          event.preventDefault();
          clearHold();
          suppressClick.current = true;
          onLongPress();
        }
      }}
    >
      <video
        ref={ref}
        poster={savedPoster ?? poster}
        loop
        playsInline
        muted={muted}
        preload={active || prebuffer ? "auto" : "none"}
        onPlaying={() => {
          setBuffering(false);
          setPlaying(true);
        }}
        onWaiting={() => {
          setBuffering(true);
          setPlaying(false);
        }}
        onCanPlay={() => setBuffering(false)}
        onError={() => {
          setBuffering(false);
          setPlaying(false);
        }}
        className={className ?? "h-full w-full object-cover"}
      />

      {/* Poster while cold loading */}
      {poster && !playing && !paused && !posterFailed && (
        <img
          src={savedPoster ?? poster}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority={active || prebuffer ? "high" : "low"}
          onError={() => setPosterFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* TikTok Centered Dual-Dot Buffering Animation */}
      {buffering && active && !paused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="relative flex h-8 w-16 items-center justify-center">
            <div
              className="absolute h-3.5 w-3.5 rounded-full"
              style={{
                backgroundColor: "#25F4EE",
                boxShadow: "0 0 12px #25F4EE",
                animation: "tiktok-cyan 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite",
              }}
            />
            <div
              className="absolute h-3.5 w-3.5 rounded-full"
              style={{
                backgroundColor: "#FE2C55",
                boxShadow: "0 0 12px #FE2C55",
                animation: "tiktok-magenta 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite",
              }}
            />
          </div>
        </div>
      )}

      {/* TikTok Bottom Buffering Progress Line */}
      {buffering && active && !paused && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2.5px] overflow-hidden bg-black/40">
          <div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#25F4EE] to-[#FE2C55]"
            style={{
              boxShadow: "0 0 8px #25F4EE, 0 0 8px #FE2C55",
              animation: "tiktok-bar 1.2s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {!online && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit bg-secondary px-3 py-1 text-xs text-secondary-foreground">
          {offlineMissing ? "This video isn't saved offline yet" : "Offline · Cached mode"}
        </div>
      )}

      {!playing && posterFailed && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card text-muted-foreground">
          <Video className="h-12 w-12" />
          <span className="text-sm">Video unavailable</span>
        </div>
      )}

      {paused && (
        <div role="status" aria-label="Video paused" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Play className="h-16 w-16 fill-foreground text-foreground drop-shadow-lg" />
        </div>
      )}

      <style>{`
        @keyframes tiktok-cyan {
          0% { transform: translateX(-14px) scale(0.9); z-index: 1; }
          50% { transform: translateX(14px) scale(1.18); z-index: 2; }
          100% { transform: translateX(-14px) scale(0.9); z-index: 1; }
        }
        @keyframes tiktok-magenta {
          0% { transform: translateX(14px) scale(1.18); z-index: 2; }
          50% { transform: translateX(-14px) scale(0.9); z-index: 1; }
          100% { transform: translateX(14px) scale(1.18); z-index: 2; }
        }
        @keyframes tiktok-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
