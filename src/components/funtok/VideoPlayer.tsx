import { useEffect, useRef, useState } from "react";
import { loadHls } from "@/lib/hls-loader";
import { Video, Play } from "lucide-react";

type Props = {
  src: string;
  poster?: string;
  active: boolean;
  prebuffer?: boolean;
  muted: boolean;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  tapToPause?: boolean;
  onWatch?: (seconds: number, percent: number) => void;
  className?: string;
};

export function VideoPlayer({ src, poster, active, prebuffer = false, muted, onTap, onDoubleTap, onLongPress, tapToPause = false, onWatch, className }: Props) {
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const clearHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; };
  useEffect(() => () => clearHold(), []);
  const singleTap = () => {
    if (!tapToPause) { onTap?.(); return; }
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (pausedRef.current) ref.current?.pause();
    else if (activeRef.current) void ref.current?.play().catch(() => undefined);
  };
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); tapTimer.current = null; }, [active]);
  const handleTap = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!onDoubleTap) { singleTap(); return; }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoubleTap();
    } else {
      tapTimer.current = setTimeout(() => { tapTimer.current = null; singleTap(); }, 280);
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
    const playWhenReady = () => { if (activeRef.current && !pausedRef.current) void el.play().catch(() => undefined); };
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
    pausedRef.current = false;
    setPaused(false);
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
    <div className="relative h-full w-full select-none overflow-hidden" onClick={handleTap}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        clearHold(); suppressClick.current = false;
        startPoint.current = { x: event.clientX, y: event.clientY };
        if (onLongPress) holdTimer.current = setTimeout(() => {
          suppressClick.current = true;
          if (tapTimer.current) clearTimeout(tapTimer.current);
          tapTimer.current = null;
          onLongPress();
        }, 550);
      }}
      onPointerMove={(event) => { if (Math.hypot(event.clientX - startPoint.current.x, event.clientY - startPoint.current.y) > 12) { clearHold(); suppressClick.current = true; } }}
      onPointerUp={clearHold} onPointerCancel={() => { clearHold(); suppressClick.current = true; }}
      onContextMenu={(event) => { if (onLongPress) { event.preventDefault(); clearHold(); suppressClick.current = true; onLongPress(); } }}>
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
    {poster && !playing && !paused && !posterFailed && <img src={poster} alt="" draggable={false} decoding="async" fetchPriority={active || prebuffer ? "high" : "low"} onError={() => setPosterFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
    {!playing && posterFailed && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card text-muted-foreground"><Video className="h-12 w-12" /><span className="text-sm">Video unavailable</span></div>}
    {paused && <div role="status" aria-label="Video paused" className="pointer-events-none absolute inset-0 flex items-center justify-center"><Play className="h-16 w-16 fill-foreground text-foreground drop-shadow-lg" /></div>}
    </div>
  );
}
