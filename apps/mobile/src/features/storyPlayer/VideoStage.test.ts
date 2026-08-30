import { describe, expect, it } from "vitest";
import { hasReachedPlaybackEnd, hasStoppedAtFinalFrame } from "./videoPlayback";

describe("hasReachedPlaybackEnd", () => {
  it("does not finish early while the final syllable may still be playing", () => {
    expect(hasReachedPlaybackEnd(3.91, 4, 4_000)).toBe(false);
  });

  it("accepts the native player's tiny floating-point difference at the end", () => {
    expect(hasReachedPlaybackEnd(3.998, 4, 4_000)).toBe(true);
  });

  it("does not finish a clip that stopped early", () => {
    expect(hasReachedPlaybackEnd(2.3, 4, 4_000)).toBe(false);
  });

  it("falls back to the published duration until native metadata is available", () => {
    expect(hasReachedPlaybackEnd(4, 0, 4_000)).toBe(true);
  });

  it("rejects non-finite playback positions", () => {
    expect(hasReachedPlaybackEnd(Number.NaN, 4, 4_000)).toBe(false);
  });
});

describe("hasStoppedAtFinalFrame", () => {
  it("finishes when a stopped native player is resting on its final decoded frame", () => {
    expect(hasStoppedAtFinalFrame(3.82, 4, 4_000)).toBe(true);
  });

  it("does not treat a mid-video playback interruption as completion", () => {
    expect(hasStoppedAtFinalFrame(2.3, 4, 4_000)).toBe(false);
  });

  it("uses the published duration while native metadata is unavailable", () => {
    expect(hasStoppedAtFinalFrame(3.9, 0, 4_000)).toBe(true);
  });
});
