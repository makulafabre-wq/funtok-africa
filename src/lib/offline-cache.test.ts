import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheMedia, cachedMediaUrl, feedStorageKey, offlineVideoUrl, readSavedFeed, saveFeed } from "./offline-cache";
import type { FeedVideo } from "./feed";
import { refuseOfflineWorker } from "./pwa";

describe("Offline feeds", () => {
  beforeEach(() => localStorage.clear());
  it.each(["foryou", "trending", "following", "nearby"] as const)("restores saved %s feed", (tab) => {
    const video = { id: "saved", bunny_video_id: "bunny", visibility: "public" } as FeedVideo;
    saveFeed(tab, "me", [video]);
    expect(readSavedFeed(tab, "me")).toEqual([video]);
  });
  it("never exposes another account's Following feed", () => {
    saveFeed("following", "first", [{ id: "saved", bunny_video_id: "bunny", visibility: "public" } as FeedVideo]);
    expect(readSavedFeed("following", "second")).toBeUndefined();
  });
  it("does not persist private video metadata", () => {
    saveFeed("foryou", undefined, [{ id: "private", bunny_video_id: "bunny", visibility: "private" } as FeedVideo]);
    expect(readSavedFeed("foryou")).toEqual([]);
  });
  it("ignores corrupt saved data", () => {
    localStorage.setItem(feedStorageKey("nearby"), "broken");
    expect(readSavedFeed("nearby")).toBeUndefined();
  });
});

describe("Offline media", () => {
  it("maps Bunny playlists to complete playable files", () => {
    expect(offlineVideoUrl("https://vz-e91c29a7-705.b-cdn.net/abc/playlist.m3u8")).toBe("https://vz-e91c29a7-705.b-cdn.net/abc/play_720p.mp4");
    expect(offlineVideoUrl("https://example.com/playlist.m3u8")).toBeUndefined();
  });
  it("stores complete files and returns a local playback URL without refetching", async () => {
    const entries = new Map<string, Response>();
    const cache = { match: vi.fn(async (url: string) => entries.get(url)?.clone()), keys: vi.fn(async () => []), put: vi.fn(async (url: string, response: Response) => { entries.set(url, response); }) };
    vi.stubGlobal("caches", { open: async () => cache });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "video/mp4" } })));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:offline") });
    await cacheMedia("https://example.com/test.mp4", "video");
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(await cachedMediaUrl("https://example.com/test.mp4")).toBe("blob:offline");
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe("Offline preview safety", () => {
  it.each(["id-preview--abc.lovable.app", "preview-v2--abc.gpt-eng.com", "project--abc-dev.lovable.app", "beta.lovable.dev", "x.lovableproject.com"])("refuses worker on %s", (host) => {
    expect(refuseOfflineWorker(host, true, false, false)).toBe(true);
  });
  it("allows the published app but refuses development, frames and kill switch", () => {
    expect(refuseOfflineWorker("funtok-africa.lovable.app", true, false, false)).toBe(false);
    expect(refuseOfflineWorker("funtok-africa.lovable.app", false, false, false)).toBe(true);
    expect(refuseOfflineWorker("funtok-africa.lovable.app", true, true, false)).toBe(true);
    expect(refuseOfflineWorker("funtok-africa.lovable.app", true, false, true)).toBe(true);
  });
});