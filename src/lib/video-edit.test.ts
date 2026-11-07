import { expect, it } from "vitest";
import { videoFilter } from "./video-edit";

it("keeps the original video unfiltered", () => {
  expect(videoFilter("none", false, false)).toBe("none");
});
it("combines selected filter, beauty and effects for export", () => {
  expect(videoFilter("grayscale(1)", true, true)).toBe("grayscale(1) brightness(1.08) contrast(0.95) saturate(1.1) hue-rotate(40deg) saturate(1.6)");
});