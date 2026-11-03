import { describe, expect, it } from "vitest";
import { availableLiveSeats, GROUP_LIVE_CAPACITY } from "./group-live";

describe("six-person live", () => {
  it("offers exactly six seats in an empty live", () => {
    expect(GROUP_LIVE_CAPACITY).toBe(6);
    expect(availableLiveSeats([])).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("does not offer a seventh seat when six people have joined", () => {
    expect(availableLiveSeats([1, 2, 3, 4, 5, 6])).toEqual([]);
  });
});