import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "./VideoPlayer";

vi.mock("@/lib/hls-loader", () => ({ loadHls: () => Promise.resolve({ default: { isSupported: () => false } }) }));

describe("Video playback gestures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it("pauses on a single tap and resumes on the next single tap", async () => {
    const { container } = render(<VideoPlayer src="video.mp4" active muted tapToPause onDoubleTap={() => {}} />);
    await act(async () => {});
    const video = container.querySelector("video");
    if (!video) throw new Error("Missing player");
    fireEvent.click(video);
    act(() => vi.advanceTimersByTime(280));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Video paused" })).toBeInTheDocument();
    fireEvent.click(video);
    act(() => vi.advanceTimersByTime(280));
    expect(screen.queryByRole("status", { name: "Video paused" })).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });
  it("opens options on a long press without turning the release into a pause", async () => {
    const onLongPress = vi.fn();
    const { container } = render(<VideoPlayer src="video.mp4" active muted tapToPause onLongPress={onLongPress} />);
    await act(async () => {});
    const video = container.querySelector("video");
    if (!video) throw new Error("Missing player");
    fireEvent.contextMenu(video);
    fireEvent.click(video);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status", { name: "Video paused" })).not.toBeInTheDocument();
  });
});