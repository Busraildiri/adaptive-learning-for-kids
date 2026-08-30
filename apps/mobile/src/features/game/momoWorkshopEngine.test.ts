import type { MomoCableEndpoint } from "@adaptive/content-schema";
import { describe, expect, it } from "vitest";
import {
  boundedMomoItemCount,
  cableEndpointsMatch,
  crystalCountMatches,
  findCableDropTarget,
  isMomoRewardLevel,
  momoFaultStageForLevel,
  momoRoundPrompt,
  momoRoundsForLevel,
  momoTaskForLevel,
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

  it("keeps adaptive Momo item counts inside the 5 by 5 board", () => {
    expect(boundedMomoItemCount(0)).toBe(1);
    expect(boundedMomoItemCount(12.8)).toBe(12);
    expect(boundedMomoItemCount(26)).toBe(25);
  });

  it("builds instructions from the generated adaptive round", () => {
    expect(
      momoRoundPrompt({
        id: "crystals",
        kind: "crystal_count",
        prompt: "Eski sabit yönerge",
        crystalCount: 8,
        targetCount: 6,
      }),
    ).toBe("6 enerji kristalini Momo'nun piline koy.");

    expect(
      momoRoundPrompt({
        id: "pattern",
        kind: "pattern_shape",
        prompt: "Eski sabit yönerge",
        sequence: ["circle", "triangle", "square"],
        choices: ["circle", "square", "triangle"],
        correctShape: "circle",
      }),
    ).toBe("daire, üçgen, kare; sıradaki şekli seç.");
  });

  it("awards one permanent Momo part every ten levels", () => {
    expect(isMomoRewardLevel(1)).toBe(false);
    expect(isMomoRewardLevel(9)).toBe(false);
    expect(isMomoRewardLevel(10)).toBe(true);
    expect(isMomoRewardLevel(140)).toBe(true);
    expect(isMomoRewardLevel(150)).toBe(true);
    expect(isMomoRewardLevel(160)).toBe(false);
  });

  it("makes every Momo level one distinct workshop task", () => {
    const baseRounds = [
      {
        id: "cables",
        kind: "cable_match" as const,
        prompt: "Kabloları bağla.",
        endpoints: [
          coralLeft,
          coralRight,
          { ...coralLeft, id: "blue-left", matchKey: "blue" },
          blueRight,
        ],
      },
      {
        id: "crystals",
        kind: "crystal_count" as const,
        prompt: "Kristalleri seç.",
        crystalCount: 5,
        targetCount: 3,
      },
      {
        id: "pattern",
        kind: "pattern_shape" as const,
        prompt: "Deseni tamamla.",
        sequence: ["circle", "square", "circle"] as const,
        choices: ["circle", "square", "triangle"] as const,
        correctShape: "square" as const,
      },
    ];

    const firstCycle = Array.from(
      { length: 5 },
      (_, index) => momoRoundsForLevel(baseRounds, index + 1)[0]?.kind,
    );
    expect(firstCycle).toEqual([
      "crystal_count",
      "pattern_shape",
      "part_match",
      "odd_part",
      "cable_match",
    ]);
    expect(new Set(firstCycle)).toHaveLength(5);
    const firstFifteen = Array.from(
      { length: 15 },
      (_, index) => momoRoundsForLevel(baseRounds, index + 1)[0]?.kind,
    );
    expect(firstFifteen.slice(0, 5)).not.toEqual(firstFifteen.slice(5, 10));
    expect(firstFifteen.slice(5, 10)).not.toEqual(firstFifteen.slice(10, 15));
    for (let index = 1; index < firstFifteen.length; index += 1) {
      expect(firstFifteen[index]).not.toBe(firstFifteen[index - 1]);
    }

    const allLevels = Array.from(
      { length: 150 },
      (_, index) => momoRoundsForLevel(baseRounds, index + 1)[0]?.kind,
    );
    expect(new Set(allLevels.slice(0, 15))).toHaveLength(5);

    const cableLevels = Array.from({ length: 150 }, (_, index) => index + 1).filter(
      (level) => momoTaskForLevel(level).kind === "cables",
    );
    expect(cableLevels).toHaveLength(4);
    const cablePairCounts = cableLevels.map((level) => {
      const round = momoRoundsForLevel(baseRounds, level)[0];
      if (round?.kind !== "cable_match") throw new Error(`Expected cables at level ${level}`);
      return round.endpoints.length / 2;
    });
    expect(cablePairCounts).toEqual([2, 3, 4, 5]);
    const finalCableLevel = cableLevels.at(-1) as number;
    expect(allLevels.slice(finalCableLevel)).not.toContain("cable_match");
  });

  it("moves faulty-part challenges through bounded visual difficulty stages", () => {
    expect(momoFaultStageForLevel(1)).toBe("shape");
    expect(momoFaultStageForLevel(15)).toBe("shape");
    expect(momoFaultStageForLevel(16)).toBe("contrast");
    expect(momoFaultStageForLevel(31)).toBe("near_color");
    expect(momoFaultStageForLevel(60)).toBe("near_color");
    expect(momoFaultStageForLevel(61)).toBe("detail");
    expect(momoFaultStageForLevel(101)).toBe("two_rules");
  });

  it("does not generate the same Momo chapter configuration twice", () => {
    const baseRounds = [
      {
        id: "cables",
        kind: "cable_match" as const,
        prompt: "Kabloları bağla.",
        endpoints: [
          coralLeft,
          coralRight,
          { ...coralLeft, id: "blue-left", matchKey: "blue" },
          blueRight,
        ],
      },
      {
        id: "crystals",
        kind: "crystal_count" as const,
        prompt: "Kristalleri seç.",
        crystalCount: 5,
        targetCount: 3,
      },
      {
        id: "pattern",
        kind: "pattern_shape" as const,
        prompt: "Deseni tamamla.",
        sequence: ["circle", "square", "circle"] as const,
        choices: ["circle", "square", "triangle"] as const,
        correctShape: "square" as const,
      },
    ];
    const seen = new Set<string>();
    for (let level = 1; level <= 150; level += 1) {
      const round = momoRoundsForLevel(baseRounds, level)[0];
      const { id: _id, ...configuration } = round;
      const signature = JSON.stringify(configuration);
      expect(seen, `duplicate chapter at level ${level}`).not.toContain(signature);
      seen.add(signature);
    }
  });

  it("keeps Momo chapter selection moving forward when difficulty falls", () => {
    const beforeSupport = momoTaskForLevel(39);
    const afterSupport = momoTaskForLevel(40);
    expect(afterSupport).not.toEqual(beforeSupport);
  });
});
