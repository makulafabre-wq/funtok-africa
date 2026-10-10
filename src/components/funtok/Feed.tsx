import { useEffect, useRef, useState } from "react";
import type { FeedEntry } from "@/lib/feed";
import { INTERSTITIAL_EVERY, showNativeInterstitial } from "@/lib/ads";
import { FeedItem } from "./FeedItem";
import { FeedAdCard, HouseAdOverlay } from "./Ads";

export function Feed({ entries, startIndex = 0, ranked }: { entries: FeedEntry[]; startIndex?: number; ranked?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [interstitial, setInterstitial] = useState(false);
  const swipes = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (el && startIndex > 0) el.scrollTo({ top: startIndex * el.clientHeight });
  }, [startIndex, entries.length]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== active) {
      setActive(idx);
      swipes.current += 1;
      if (swipes.current % INTERSTITIAL_EVERY === 0) {
        showNativeInterstitial().then((shown) => { if (!shown) setInterstitial(true); }).catch(() => {});
      }
    }
  };

  let rank = 0;
  return (
    <>
      <div ref={ref} onScroll={onScroll} className="snap-feed scrollbar-none h-full w-full">
        {entries.map((e, i) => {
          if (e.kind === "video") rank += 1;
          return (
            <div key={e.kind === "video" ? e.video.id : e.key} className="h-full w-full snap-start snap-always">
              {Math.abs(i - active) <= 2 ? (
                e.kind === "video" ? (
                  <FeedItem video={e.video} active={i === active && !interstitial} muted={muted} onToggleMute={() => setMuted((m) => !m)} rank={ranked ? rank : undefined} />
                ) : (
                  <FeedAdCard ad={e.ad} active={i === active} />
                )
              ) : null}
            </div>
          );
        })}
      </div>
      {interstitial && <HouseAdOverlay seconds={5} title="Ad" onDone={() => {}} onClose={() => setInterstitial(false)} />}
    </>
  );
}
