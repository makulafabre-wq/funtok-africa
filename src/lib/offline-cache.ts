import type { FeedTab, FeedVideo } from "./feed";

const MEDIA_CACHE = "funtok-video-v1";
const FEED_PREFIX = "funtok-feed-v1:";
const MAX_FILE = 30 * 1024 * 1024;
const MAX_TOTAL = 120 * 1024 * 1024;
const inFlight = new Map<string, Promise<void>>();
let queue = Promise.resolve();

export function feedStorageKey(tab: FeedTab, userId?: string) {
  return `${FEED_PREFIX}${tab}:${tab === "following" ? userId ?? "signed-out" : "public"}`;
}

export function readSavedFeed(tab: FeedTab, userId?: string): FeedVideo[] | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(feedStorageKey(tab, userId)) ?? "null");
    if (!Array.isArray(value) || !value.every((v) => v && typeof v.id === "string" && typeof v.bunny_video_id === "string" && v.visibility === "public")) return undefined;
    return value as FeedVideo[];
  } catch { return undefined; }
}

export function saveFeed(tab: FeedTab, userId: string | undefined, videos: FeedVideo[]) {
  try { localStorage.setItem(feedStorageKey(tab, userId), JSON.stringify(videos.filter((v) => v.visibility === "public").slice(0, 50))); }
  catch { /* Private mode or exhausted storage must not break playback. */ }
}

export function offlineVideoUrl(src: string): string | undefined {
  try {
    const url = new URL(src);
    if (url.hostname !== "vz-e91c29a7-705.b-cdn.net" || !url.pathname.endsWith("/playlist.m3u8")) return undefined;
    url.pathname = url.pathname.replace(/playlist\.m3u8$/, "play_720p.mp4");
    return url.href;
  } catch { return undefined; }
}

export async function cachedMediaUrl(url: string): Promise<string | undefined> {
  try {
    if (typeof caches === "undefined") return undefined;
    const response = await (await caches.open(MEDIA_CACHE)).match(url);
    if (!response) return undefined;
    return URL.createObjectURL(await response.blob());
  } catch { return undefined; }
}

export function cacheMedia(url: string, kind: "video" | "image"): Promise<void> {
  const existing = inFlight.get(url);
  if (existing) return existing;
  const work = queue.then(async () => {
    if (!navigator.onLine || typeof caches === "undefined") return;
    const cache = await caches.open(MEDIA_CACHE);
    if (await cache.match(url)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok || response.status === 206 || response.type === "opaque") return;
      if (Number(response.headers.get("content-length")) > MAX_FILE) return;
      const reader = response.body?.getReader();
      if (!reader) return;
      const chunks: ArrayBuffer[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_FILE) { await reader.cancel(); return; }
        chunks.push(value.slice().buffer);
      }
      const type = response.headers.get("content-type") ?? "";
      if (!size || !type.startsWith(`${kind}/`)) return;
      let total = size;
      const keys = await cache.keys();
      for (const key of keys) total += Number((await cache.match(key))?.headers.get("content-length") ?? 0);
      for (const key of keys) {
        if (total <= MAX_TOTAL) break;
        total -= Number((await cache.match(key))?.headers.get("content-length") ?? 0);
        await cache.delete(key);
      }
      await cache.put(url, new Response(new Blob(chunks, { type }), { headers: { "Content-Type": type, "Content-Length": String(size) } }));
    } finally { clearTimeout(timer); }
  }).catch(() => undefined).finally(() => { inFlight.delete(url); });
  inFlight.set(url, work);
  queue = work;
  return work;
}