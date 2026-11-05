import { useEffect, useRef, useState } from "react";
import { loadHls } from "@/lib/hls-loader";
import { Video } from "lucide-react";

type Props = {
  src: string;
  poster?: string;
  active: boolean;
  prebuffer?: boolean;
  muted: boolean;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onWatch?: (seconds: number, percent: number) => void;
  className?: string;
};

export function VideoPlayer({ src, poster, active, prebuffer = false, muted, onTap, onDoubleTap, onWatch, className }: Props) {
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); tapTimer.current = null; }, [active]);
  const handleTap = () => {
    if (!onDoubleTap) { onTap?.(); return; }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoubleTap();
    } else {
      tapTimer.current = setTimeout(() => { tapTimer.current = null; onTap?.(); }, 280);
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
    setPosterFailed(false);
    let cancelled = false;
    const playWhenReady = () => { if (activeRef.current) void el.play().catch(() => undefined); };
    el.addEventListener("loadeddata", playWhenReady);
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
    } else {
      loadHls().then(({ default: Hls }) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          const h = new Hls({ autoStartLoad: false, maxBufferLength: 8, maxMaxBufferLength: 12, backBufferLength: 2 });
          hlsRef.current = h;
          h.loadSource(src);
          h.attachMedia(el);
          h.on(Hls.Events.MANIFEST_PARSED, () => { if (bufferRef.current) h.startLoad(); playWhenReady(); });
        } else el.src = src;
      }).catch(() => { if (!cancelled) el.src = src; });
    }
    return () => { cancelled = true; el.removeEventListener("loadeddata", playWhenReady); hlsRef.current?.destroy(); hlsRef.current = null; el.pause(); el.removeAttribute("src"); el.load(); };
  }, [src]);

  useEffect(() => {
    if (active || prebuffer) hlsRef.current?.startLoad();
    else hlsRef.current?.stopLoad();
  }, [active, prebuffer]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) el.play().catch(() => {});
    else { el.pause(); setPlaying(false); }
  }, [active, src]);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    let watched = 0;
    let maxPct = 0;
    let last = el.currentTime;
    const onTime = () => {
      const t = el.currentTime;
      const d = el.duration || 0;
      if (t > last && t - last < 2) watched += t - last;
      if (t < last) maxPct = 100; // looped
      last = t;
      if (d) maxPct = Math.max(maxPct, (t / d) * 100);
    };
    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      if (watched > 1) watchRef.current?.(watched, Math.min(100, maxPct));
    };
  }, [active]);

  return (
    <div className="relative h-full w-full overflow-hidden" onClick={handleTap}>
    <video
      ref={ref}
      poster={poster}
      loop
      playsInline
      muted={muted}
      preload={active || prebuffer ? "auto" : "none"}
      onPlaying={() => setPlaying(true)}
      onWaiting={() => setPlaying(false)}
      onError={() => setPlaying(false)}
      className={className ?? "h-full w-full object-cover"}
    />
    {poster && !playing && !posterFailed && <img src={poster} alt="" decoding="async" fetchPriority={active || prebuffer ? "high" : "low"} onError={() => setPosterFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
    {!playing && posterFailed && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card text-muted-foreground"><Video className="h-12 w-12" /><span className="text-sm">Video unavailable</span></div>}
    </div>
  );
}
