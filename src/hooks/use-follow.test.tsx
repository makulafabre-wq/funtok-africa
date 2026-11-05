import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFollow } from "./use-follow";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  insert: mocks.insert,
  delete: () => ({ eq: () => ({ eq: mocks.remove }) }),
}) } }));

describe("Shared creator following", () => {
  it("follows and unfollows the creator and shares the result across both controls", async () => {
    mocks.insert.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => ({ feed: useFollow("creator", "viewer"), profile: useFollow("creator", "viewer") }), { wrapper });
    await waitFor(() => expect(result.current.feed.pending).toBe(false));
    act(() => result.current.feed.toggle());
    await waitFor(() => expect(result.current.profile.following).toBe(true));
    expect(mocks.insert).toHaveBeenCalledWith({ follower_id: "viewer", following_id: "creator" });
    act(() => result.current.profile.toggle());
    await waitFor(() => expect(result.current.feed.following).toBe(false));
    expect(mocks.remove).toHaveBeenCalledWith("following_id", "creator");
  });
});