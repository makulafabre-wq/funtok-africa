import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useHydrated } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Search, Camera, Rocket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHorizontalSwipe } from "@/hooks/use-swipe";
import { fetchFeed, injectAds, type FeedTab, type HouseAd } from "@/lib/feed";
import { showNativeRewarded } from "@/lib/ads";
import { Feed } from "@/components/funtok/Feed";
import { FireHub } from "@/components/funtok/FireHub";
import { BottomNav } from "@/components/funtok/BottomNav";
import { SideToggle } from "@/components/funtok/SideToggle";
import { Logo } from "@/components/funtok/Logo";
import { BannerAd, HouseAdOverlay, useAdSetup } from "@/components/funtok/Ads";
import { readSavedFeed, saveFeed } from "@/lib/offline-cache";
import { useOnline } from "@/hooks/use-online";

const TABS: { id: FeedTab; label: string }[] = [
  { id: "foryou", label: "For You" },
  { id: "fire", label: "🔥 Fire" },
  { id: "following", label: "Following" },
  { id: "trending", label: "Trending 🔥" },
  { id: "nearby", label: "Nearby" },
];

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { tab?: FeedTab | undefined; v?: string | undefined } => ({
    tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as FeedTab) : undefined,
    v: typeof s["v"] === "string" ? s["v"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Funtok — Fun Side videos from Kampala" },
      { name: "description", content: "Swipe trending short videos from Uganda, then jump to Chat Side to share them with friends." },
      { property: "og:title", content: "Funtok — Fun Side videos from Kampala" },
      { property: "og:description", content: "Swipe trending short videos from Uganda and share them in chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FunSide,
});

function FunSide() {
  const { tab = "foryou", v } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const swipe = useHorizontalSwipe(() => { if (tab !== "fire") void navigate({ to: "/chat" }); });
  const ads = useAdSetup();
  const [rewarding, setRewarding] = useState(false);
  const online = useOnline();

  const [visited, setVisited] = useState<FeedTab[]>([tab]);
  useEffect(() => { setVisited((previous) => previous.includes(tab) ? previous : [...previous, tab]); }, [tab]);
  const mountedTabs = visited.includes(tab) ? visited : [...visited, tab];

  const boost = async (): Promise<void> => {
    if (!user) { toast("Sign in to boost your video"); return; }
    const res = await showNativeRewarded().catch(() => null);
    if (res === null) setRewarding(true);
    else if (res) applyBoost();
  };
  const applyBoost = async (): Promise<void> => {
    if (!user) return;
    const { data } = await supabase.from("videos").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) { toast("Post a video first, then boost it"); return; }
    const { error } = await supabase.rpc("boost_video", { _video_id: data.id });
    if (error) toast.error("Boost failed"); else toast.success("Your latest video is boosted x2 for 1 hour 🔥");
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background" {...swipe}>
      <div className="relative flex-1 overflow-hidden">
        {mountedTabs.map((panel) => <div key={panel} className="absolute inset-0" hidden={panel !== tab}>
          {panel === "fire" ? (panel === tab ? <FireHub /> : null) : <FeedPanel tab={panel} active={panel === tab} userId={user?.id} sharedVideo={v} adSetup={ads.data} />}
        </div>)}

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 bg-gradient-to-b from-overlay to-transparent px-3 pb-6 pt-3">
          <div className="pointer-events-auto flex items-center justify-between">
            <Logo size="sm" />
            <SideToggle active="fun" overlay />
            <div className="flex gap-3">
              <Search className="h-5 w-5" />
              <Link to="/upload" aria-label="Camera"><Camera className="h-5 w-5" /></Link>
            </div>
          </div>
          <div className="scrollbar-none pointer-events-auto flex justify-center gap-4 overflow-x-auto text-sm font-semibold">
            {TABS.map((t) => (
              <Link key={t.id} to="/" search={t.id === "foryou" ? {} : { tab: t.id }}
                className={`whitespace-nowrap pb-1 text-shadow ${tab === t.id ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"}`}>
                {t.label}
              </Link>
            ))}
          </div>
          {!online && <div role="status" className="bg-secondary px-3 py-1 text-center text-xs text-secondary-foreground">Offline · Cached mode</div>}
          {tab === "trending" && (
            <div className="pointer-events-auto flex items-center justify-between rounded-xl bg-overlay px-3 py-2 text-xs">
              <span className="flex items-center gap-1 font-semibold"><Flame className="h-4 w-4 text-primary" /> Trending in Kampala · Top 50</span>
              <button onClick={boost} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground">
                <Rocket className="h-3.5 w-3.5" /> Watch ad · Boost x2
              </button>
            </div>
          )}
        </header>
      </div>
      <BannerAd />
      <BottomNav />
      {rewarding && (
        <HouseAdOverlay seconds={15} title="Watch to boost your video" onDone={() => { applyBoost(); }} onClose={() => setRewarding(false)} />
      )}
    </div>
  );
}

function FeedPanel({ tab, active, userId, sharedVideo, adSetup }: {
  tab: FeedTab; active: boolean; userId: string | undefined; sharedVideo: string | undefined;
  adSetup: { ads: HouseAd[]; every: number; enabled: boolean } | undefined;
}) {
  const hydrated = useHydrated();
  const online = useOnline();
  const saved = hydrated ? readSavedFeed(tab, userId) : undefined;
  const feed = useQuery({ queryKey: ["feed", tab, userId], queryFn: () => fetchFeed(tab, userId), placeholderData: () => saved, enabled: active && online, staleTime: 5 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false });
  useEffect(() => { if (feed.data && !feed.isPlaceholderData) saveFeed(tab, userId, feed.data); }, [feed.data, feed.isPlaceholderData, tab, userId]);
  const entries = injectAds(feed.data ?? saved ?? [], adSetup?.ads ?? [], adSetup?.every ?? 5, online && (adSetup?.enabled ?? true) && tab !== "trending");
  const startIndex = sharedVideo ? Math.max(0, entries.findIndex((entry) => entry.kind === "video" && entry.video.id === sharedVideo)) : 0;
  if (feed.isLoading && !entries.length) return <div className="flex h-full items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!online && !entries.length) return <div className="flex h-full items-center justify-center px-8 text-center text-muted-foreground">No saved videos in this tab yet.</div>;
  if (!entries.length) return <EmptyFeed tab={tab} signedIn={!!userId} />;
  return <Feed entries={entries} startIndex={startIndex} ranked={tab === "trending"} enabled={active} />;
}

function EmptyFeed({ tab, signedIn }: { tab: FeedTab; signedIn: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="font-display text-2xl font-bold">
        {tab === "following" && !signedIn ? "Sign in to see who you follow" : tab === "following" ? "Follow creators to fill this feed" : "No videos yet"}
      </p>
      <p className="text-sm text-muted-foreground">Be the first to post on the Fun Side.</p>
      <Link to={signedIn ? "/upload" : "/auth"} className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow">
        {signedIn ? "Post a video" : "Sign in"}
      </Link>
    </div>
  );
}
