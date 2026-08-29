import { describe, expect, it } from "vitest";
import { hasReachedPlaybackEnd } from "./videoPlayback";

describe("hasReachedPlaybackEnd", () => {
  it("accepts the native player's final timing tolerance", () => {
    expect(hasReachedPlaybackEnd(3.91, 4, 4_000)).toBe(true);
  });

  it("does not finish a clip that stopped early", () => {
    expect(hasReachedPlaybackEnd(2.3, 4, 4_000)).toBe(false);
  });

  it("falls back to the published duration until native metadata is available", () => {
    expect(hasReachedPlaybackEnd(3.95, 0, 4_000)).toBe(true);
  });

  it("rejects non-finite playback positions", () => {
    expect(hasReachedPlaybackEnd(Number.NaN, 4, 4_000)).toBe(false);
  });
});
