import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareVideoDownload } from "./video-download";

describe("Video download preparation", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("rejects blocked video responses rather than downloading an error page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(prepareVideoDownload("video-id")).rejects.toThrow("unavailable");
  });
  it("returns a nonempty video Blob when Bunny provides an MP4", async () => {
    const video = new Blob(["video bytes"], { type: "video/mp4" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => video }));
    expect(await prepareVideoDownload("video-id")).toBe(video);
  });
});