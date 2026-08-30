import type { MomoCableEndpoint, MomoShape, MomoWorkshopRound } from "@adaptive/content-schema";

export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };
export type CableDropTarget = {
  id: string;
  bounds: Bounds;
  connected?: boolean;
};

export type GuidedAttemptOutcome = "matched" | "retry" | "reveal";
export type MomoBonusRound =
  | { id: string; kind: "gear_match"; prompt: string; targetSize: number; choices: number[] }
  | {
      id: string;
      kind: "odd_part";
      prompt: string;
      choices: MomoShape[];
      correctIndex: number;
    };
export type MomoPlayableRound = MomoWorkshopRound | MomoBonusRound;

const shapeLabels: Record<MomoShape, string> = {
  circle: "daire",
  square: "kare",
  triangle: "üçgen",
};

export function momoRoundPrompt(round: MomoPlayableRound): string {
  if (round.kind === "crystal_count") {
    return `${round.targetCount} enerji kristalini Momo'nun piline koy.`;
  }
  if (round.kind === "pattern_shape") {
    const sequence = round.sequence.map((shape) => shapeLabels[shape]).join(", ");
    return `${sequence}; sıradaki şekli seç.`;
  }
  return round.prompt;
}

export function momoRoundsForLevel(
  baseRounds: readonly MomoWorkshopRound[],
  adaptiveLevel: number,
): MomoPlayableRound[] {
  const level = Math.max(1, Math.min(150, Math.floor(adaptiveLevel)));
  const occurrence = Math.floor((level - 1) / 5) + 1;
  const leveledBase = baseRounds.map((round): MomoWorkshopRound => {
    if (round.kind === "cable_match" && level >= 31) {
      return { ...round, prompt: "Enerji devresindeki eş renkli bağlantıları tamamla." };
    }
    if (round.kind === "pattern_shape" && level >= 61) {
      return { ...round, prompt: "Montaj sırasındaki eksik robot parçasını seç." };
    }
    if (round.kind === "crystal_count" && level >= 101) {
      return {
        ...round,
        prompt: `${round.targetCount} güç modülünü enerji çekirdeğine yerleştir.`,
      };
    }
    return round;
  });
  const gearChoiceCount = Math.min(5, 2 + occurrence);
  const gearRound: MomoBonusRound = {
    id: `momo-gear-${level}`,
    kind: "gear_match",
    prompt: "Boşluğa uyan büyüklükteki dişliyi seç.",
    targetSize: 1 + ((occurrence - 1) % gearChoiceCount),
    choices: Array.from({ length: gearChoiceCount }, (_, index) => index + 1),
  };
  const oddChoiceCount = Math.min(25, 4 + occurrence);
  const oddIndex = level % oddChoiceCount;
  const commonShape: MomoShape = level % 2 === 0 ? "circle" : "square";
  const oddShape: MomoShape = commonShape === "circle" ? "triangle" : "circle";
  const oddRound: MomoBonusRound = {
    id: `momo-odd-${level}`,
    kind: "odd_part",
    prompt: "Diğerlerinden farklı olan arızalı parçayı bul.",
    choices: Array.from({ length: oddChoiceCount }, (_, index) =>
      index === oddIndex ? oddShape : commonShape,
    ),
    correctIndex: oddIndex,
  };
  const [cables, crystals, pattern] = leveledBase;
  const colors = ["coral", "blue", "yellow", "green", "purple"] as const;
  const pairCount = Math.min(5, 1 + occurrence);
  const expandedCables =
    cables?.kind === "cable_match"
      ? {
          ...cables,
          id: `${cables.id}-encounter-${occurrence}`,
          endpoints: colors.slice(0, pairCount).flatMap((color, index) => [
            {
              id: `${color}-left-${occurrence}`,
              label: `Sol ${color} kablo ucu`,
              color,
              matchKey: `${color}-${index}`,
              side: "left" as const,
            },
            {
              id: `${color}-right-${occurrence}`,
              label: `Sağ ${color} kablo ucu`,
              color,
              matchKey: `${color}-${index}`,
              side: "right" as const,
            },
          ]),
        }
      : cables;
  const crystalCount = Math.min(
    25,
    Math.max(crystals?.kind === "crystal_count" ? crystals.crystalCount : 2, 2 + occurrence),
  );
  const expandedCrystals =
    crystals?.kind === "crystal_count"
      ? {
          ...crystals,
          id: `${crystals.id}-encounter-${occurrence}`,
          crystalCount,
          targetCount: 1 + ((occurrence - 1) % crystalCount),
        }
      : crystals;
  const patternLength = Math.min(
    24,
    Math.max(pattern?.kind === "pattern_shape" ? pattern.sequence.length : 2, 2 + occurrence),
  );
  const expandedPattern =
    pattern?.kind === "pattern_shape"
      ? {
          ...pattern,
          id: `${pattern.id}-encounter-${occurrence}`,
          sequence: Array.from(
            { length: patternLength },
            (_, index) => pattern.sequence[index % pattern.sequence.length] as MomoShape,
          ),
          correctShape:
            pattern.sequence[patternLength % pattern.sequence.length] ?? pattern.correctShape,
        }
      : pattern;
  const levelCycle = [
    expandedCrystals,
    expandedPattern,
    gearRound,
    oddRound,
    expandedCables,
  ].filter((round): round is MomoPlayableRound => Boolean(round));
  return [levelCycle[(level - 1) % levelCycle.length] as MomoPlayableRound];
}

export function boundedMomoItemCount(itemCount: number): number {
  return Math.max(1, Math.min(25, Math.floor(itemCount)));
}

export function isMomoRewardLevel(adaptiveLevel: number): boolean {
  return adaptiveLevel >= 10 && adaptiveLevel <= 150 && adaptiveLevel % 10 === 0;
}

export function cableEndpointsMatch(first: MomoCableEndpoint, second: MomoCableEndpoint): boolean {
  return first.id !== second.id && first.side !== second.side && first.matchKey === second.matchKey;
}

export function dropPointHitsBounds(point: Point, bounds: Bounds, tolerance = 18): boolean {
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
}

export function findCableDropTarget(
  point: Point,
  sourceId: string,
  candidates: CableDropTarget[],
  tolerance = 18,
): string | null {
  const matchingCandidates = candidates.filter(
    (candidate) =>
      candidate.id !== sourceId &&
      !candidate.connected &&
      dropPointHitsBounds(point, candidate.bounds, tolerance),
  );
  matchingCandidates.sort((left, right) => {
    const leftX = left.bounds.x + left.bounds.width / 2;
    const leftY = left.bounds.y + left.bounds.height / 2;
    const rightX = right.bounds.x + right.bounds.width / 2;
    const rightY = right.bounds.y + right.bounds.height / 2;
    return (
      (point.x - leftX) ** 2 +
      (point.y - leftY) ** 2 -
      ((point.x - rightX) ** 2 + (point.y - rightY) ** 2)
    );
  });
  return matchingCandidates[0]?.id ?? null;
}

export function crystalCountMatches(selectedCount: number, targetCount: number): boolean {
  return selectedCount === targetCount;
}

export function patternShapeMatches(selected: MomoShape, correct: MomoShape): boolean {
  return selected === correct;
}

export function outcomeForGuidedAttempt(
  correct: boolean,
  previousWrongAttempts: number,
  secondTryEnabled: boolean,
): GuidedAttemptOutcome {
  if (correct) return "matched";
  return secondTryEnabled && previousWrongAttempts === 0 ? "retry" : "reveal";
}
