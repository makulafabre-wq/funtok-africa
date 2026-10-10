import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";
import { fetchAdSetup, trackAd, type HouseAd } from "@/lib/feed";
import { playlistUrl } from "@/lib/bunny";
import { hideNativeBanner, showNativeBanner } from "@/lib/ads";
import { VideoPlayer } from "./VideoPlayer";

export function useAdSetup() {
  return useQuery({ queryKey: ["ad-setup"], queryFn: fetchAdSetup, staleTime: 5 * 60_000 });
}

function openAd(ad: HouseAd) {
  trackAd(ad.id, "click");
  if (ad.cta_link) window.open(ad.cta_link, "_blank", "noopener");
}

/** Full-screen "native" ad slot in the feed. */
export function FeedAdCard({ ad, active }: { ad: HouseAd | null; active: boolean }) {
  useEffect(() => { if (active && ad) trackAd(ad.id, "impression"); }, [active, ad]);
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-card">
      {ad?.video_bunny_id ? (
        <VideoPlayer src={playlistUrl(ad.video_bunny_id)} active={active} muted />
      ) : ad?.image_url ? (
        <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" />
      ) : (
        <div className="bg-brand absolute inset-0 opacity-30" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-scrim" />
      <div className="absolute bottom-8 left-4 right-4 space-y-3">
        <span className="rounded bg-overlay px-2 py-0.5 text-[11px] font-semibold">Sponsored • Kampala</span>
        <p className="font-display text-xl font-bold text-shadow">{ad?.title ?? "Your brand on Funtok"}</p>
        <button onClick={() => ad && openAd(ad)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground">
          {ad?.cta_text ?? "Learn more"} <ExternalLink className="h-4 w-4" />
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
    return () => { on = false; hideNativeBanner(); };
  }, []);
  const ad = data?.ads[0];
  useEffect(() => { if (ad && !native && !closed) trackAd(ad.id, "impression"); }, [ad, native, closed]);
  if (native || closed || !data?.enabled || !ad) return null;
  return (
    <div className="relative z-20 flex items-center gap-3 border-t border-border bg-card px-3 py-2">
      <span className="rounded bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground">AD</span>
      <button onClick={() => openAd(ad)} className="flex-1 truncate text-left text-xs font-medium">{ad.title}</button>
      <button onClick={() => openAd(ad)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{ad.cta_text}</button>
      <button onClick={() => setClosed(true)} aria-label="Close ad" className="text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}

/** Web stand-in for interstitial / rewarded ads. */
export function HouseAdOverlay({ seconds, title, onDone, onClose }: { seconds: number; title: string; onDone: () => void; onClose: () => void }) {
  const { data } = useAdSetup();
  const [left, setLeft] = useState(seconds);
  const ad = data?.ads[0];
  useEffect(() => { if (ad) trackAd(ad.id, "impression"); }, [ad]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0) { if (!fired.current) { fired.current = true; doneRef.current(); } return; }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{title}</span>
      <p className="font-display text-2xl font-bold">{ad?.title ?? "Advertise on Funtok"}</p>
      {ad && <button onClick={() => openAd(ad)} className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">{ad.cta_text}</button>}
      <button onClick={left <= 0 ? onClose : undefined} className="absolute right-4 top-4 rounded-full bg-secondary px-3 py-1 text-sm">
        {left > 0 ? `${left}s` : <X className="h-4 w-4" />}
      </button>
    </div>
  );
}
