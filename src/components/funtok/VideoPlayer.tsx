import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string;
  active: boolean;
  muted: boolean;
  onTap?: () => void;
  onWatch?: (seconds: number, percent: number) => void;
  className?: string;
};

export function VideoPlayer({ src, poster, active, muted, onTap, onWatch, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const watchRef = useRef(onWatch);
  watchRef.current = onWatch;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let hls: { destroy: () => void } | undefined;
    let cancelled = false;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          const h = new Hls({ maxBufferLength: 10 });
          h.loadSource(src);
          h.attachMedia(el);
          hls = h;
        } else el.src = src;
      });
    }
    return () => { cancelled = true; hls?.destroy(); };
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) el.play().catch(() => {});
    else el.pause();
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
    <video
      ref={ref}
      poster={poster}
      loop
      playsInline
      muted={muted}
      preload="metadata"
      onClick={onTap}
      className={className ?? "h-full w-full object-cover"}
    />
  );
}
