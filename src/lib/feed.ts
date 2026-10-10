import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FeedVideo = Tables<"videos"> & {
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};
export type HouseAd = Tables<"ads">;
export type FeedEntry = { kind: "video"; video: FeedVideo } | { kind: "ad"; ad: HouseAd | null; key: string };
export type FeedTab = "foryou" | "following" | "trending" | "nearby";

const SELECT = "*, profiles(username, display_name, avatar_url)";

export async function fetchFeed(tab: FeedTab, userId?: string): Promise<FeedVideo[]> {
  if (tab === "trending") {
    const { data } = await supabase.from("videos").select(SELECT).eq("visibility", "public").order("trending_score", { ascending: false }).limit(50);
    return (data ?? []) as FeedVideo[];
  }
  if (tab === "nearby") {
    const { data } = await supabase.from("videos").select(SELECT).eq("visibility", "public").ilike("location", "%kampala%").order("created_at", { ascending: false }).limit(30);
    return (data ?? []) as FeedVideo[];
  }
  if (tab === "following") {
    if (!userId) return [];
    const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    const ids = (f ?? []).map((r) => r.following_id);
    if (!ids.length) return [];
    const { data } = await supabase.from("videos").select(SELECT).eq("visibility", "public").in("user_id", ids).order("created_at", { ascending: false }).limit(30);
    return (data ?? []) as FeedVideo[];
  }
  // For You: top 20 by trending, mixed with ~20% fresh videos from the last hour
  const since = new Date(Date.now() - 3600_000).toISOString();
  const [top, fresh] = await Promise.all([
    supabase.from("videos").select(SELECT).eq("visibility", "public").order("trending_score", { ascending: false }).limit(20),
    supabase.from("videos").select(SELECT).eq("visibility", "public").gt("created_at", since).order("created_at", { ascending: false }).limit(5),
  ]);
  return mixForYou((top.data ?? []) as FeedVideo[], (fresh.data ?? []) as FeedVideo[]);
}

/** Interleaves fresh videos at every 5th slot (≈20%), skipping duplicates. */
export function mixForYou<T extends { id: string }>(top: T[], fresh: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const freshQ = fresh.filter((f) => !top.some((t) => t.id === f.id));
  let ti = 0;
  while (ti < top.length || freshQ.length) {
    const useFresh = freshQ.length > 0 && ((out.length + 1) % 5 === 0 || ti >= top.length);
    const next = useFresh ? freshQ.shift()! : top[ti++];
    if (next && !seen.has(next.id)) { seen.add(next.id); out.push(next); }
  }
  return out;
}

/** Splices an ad slot after every `every` videos. */
export function injectAds(videos: FeedVideo[], ads: HouseAd[], every: number, enabled: boolean): FeedEntry[] {
  const out: FeedEntry[] = [];
  videos.forEach((v, i) => {
    out.push({ kind: "video", video: v });
    if (enabled && every > 0 && (i + 1) % every === 0) {
      out.push({ kind: "ad", ad: ads.length ? ads[(i / every) % ads.length | 0] ?? null : null, key: `ad-${i}` });
    }
  });
  return out;
}

export async function fetchAdSetup() {
  const [cfg, ads] = await Promise.all([
    supabase.from("ad_config").select("*").eq("id", 1).maybeSingle(),
    supabase.from("ads").select("*").eq("is_active", true).limit(20),
  ]);
  return { enabled: cfg.data?.ads_enabled ?? true, every: cfg.data?.feed_ad_frequency ?? 5, ads: ads.data ?? [] };
}

export const trackAd = (id: string, kind: "impression" | "click") => supabase.rpc("track_ad", { _ad_id: id, _kind: kind }).then(() => {});
