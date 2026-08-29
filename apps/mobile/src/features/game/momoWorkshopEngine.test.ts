import type { MomoCableEndpoint } from "@adaptive/content-schema";
import { describe, expect, it } from "vitest";
import {
  cableEndpointsMatch,
  crystalCountMatches,
  findCableDropTarget,
  outcomeForGuidedAttempt,
  patternShapeMatches,
} from "./momoWorkshopEngine";

const coralLeft: MomoCableEndpoint = {
  id: "coral-left",
  label: "Sol mercan kablo",
  color: "coral",
  matchKey: "coral",
  side: "left",
};
const coralRight: MomoCableEndpoint = {
  id: "coral-right",
  label: "Sağ mercan kablo",
  color: "coral",
  matchKey: "coral",
  side: "right",
};
const blueRight: MomoCableEndpoint = {
  ...coralRight,
  id: "blue-right",
  color: "blue",
  matchKey: "blue",
};

describe("momoWorkshopEngine", () => {
  it("matches only opposite cable ends with the same key", () => {
    expect(cableEndpointsMatch(coralLeft, coralRight)).toBe(true);
    expect(cableEndpointsMatch(coralLeft, blueRight)).toBe(false);
    expect(cableEndpointsMatch(coralLeft, { ...coralRight, side: "left" })).toBe(false);
  });

  it("selects the nearest available dynamic drop target", () => {
    expect(
      findCableDropTarget({ x: 104, y: 50 }, "source", [
        { id: "far", bounds: { x: 90, y: 30, width: 40, height: 40 } },
        { id: "near", bounds: { x: 98, y: 42, width: 20, height: 20 } },
        { id: "connected", bounds: { x: 100, y: 40, width: 20, height: 20 }, connected: true },
      ]),
    ).toBe("near");
  });

  it("returns null when the drop is outside every target", () => {
    expect(
      findCableDropTarget({ x: 300, y: 300 }, "source", [
        { id: "target", bounds: { x: 20, y: 20, width: 40, height: 40 } },
      ]),
    ).toBeNull();
  });

  it("validates crystal counts and pattern shapes", () => {
    expect(crystalCountMatches(3, 3)).toBe(true);
    expect(crystalCountMatches(2, 3)).toBe(false);
    expect(patternShapeMatches("triangle", "triangle")).toBe(true);
    expect(patternShapeMatches("square", "triangle")).toBe(false);
  });

  it("retries once and reveals after the next wrong attempt", () => {
    expect(outcomeForGuidedAttempt(false, 0, true)).toBe("retry");
    expect(outcomeForGuidedAttempt(false, 1, true)).toBe("reveal");
    expect(outcomeForGuidedAttempt(true, 1, true)).toBe("matched");
  });
});
