import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedVideo } from "@/lib/feed";
import { FeedItem } from "./FeedItem";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), remove: vi.fn(), mute: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));
vi.mock("@/hooks/use-follow", () => ({ useFollow: () => ({ following: false, ownProfile: false, pending: false, toggle: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  insert: mocks.insert,
  delete: mocks.remove,
}) } }));
vi.mock("@/lib/hls-loader", () => ({ loadHls: () => Promise.resolve({ default: { isSupported: () => false } }) }));
vi.mock("./CommentsSheet", () => ({ CommentsSheet: () => null }));
vi.mock("./SendToChatSheet", () => ({ SendToChatSheet: () => null }));

describe("Feed double-tap likes", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.insert.mockResolvedValue({ error: null }); });
  it("likes once on double-tap without unliking on another double-tap or toggling mute", async () => {
    const video = { id: "video", user_id: "creator", bunny_video_id: "bunny", likes_count: 4, comments_count: 0, shares_count: 0, caption: "", profiles: { username: "creator" } } as FeedVideo;
    const { container } = render(<FeedItem video={video} active muted onToggleMute={mocks.mute} />);
    await act(async () => {});
    const player = container.querySelector("video");
    if (!player) throw new Error("Missing player");
    await act(async () => { fireEvent.click(player); fireEvent.click(player); });
    expect(mocks.insert).toHaveBeenCalledExactlyOnceWith({ video_id: "video", user_id: "viewer" });
    expect(screen.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "true");
    await act(async () => { fireEvent.click(player); fireEvent.click(player); });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.mute).not.toHaveBeenCalled();
  });
});