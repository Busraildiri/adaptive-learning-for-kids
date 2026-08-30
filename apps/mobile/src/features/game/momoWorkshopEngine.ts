import type { MomoCableEndpoint, MomoShape, MomoWorkshopRound } from "@adaptive/content-schema";

export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };
export type CableDropTarget = {
  id: string;
  bounds: Bounds;
  connected?: boolean;
};

export type GuidedAttemptOutcome = "matched" | "retry" | "reveal";
export type MomoPartKind = "antenna" | "arm" | "battery" | "wheel" | "sensor";
export type MomoFaultStage = "shape" | "contrast" | "near_color" | "detail" | "two_rules";
export type MomoFaultyPart = {
  shape: MomoShape;
  color: string;
  marked?: boolean;
};
export type MomoBonusRound =
  | {
      id: string;
      kind: "part_match";
      prompt: string;
      targetPart: MomoPartKind;
      choices: MomoPartKind[];
    }
  | {
      id: string;
      kind: "odd_part";
      prompt: string;
      stage: MomoFaultStage;
      choices: MomoFaultyPart[];
      correctIndex: number;
    };
export type MomoPlayableRound = MomoWorkshopRound | MomoBonusRound;

type MomoTaskKind = "crystals" | "pattern" | "part" | "odd" | "cables";

const momoTaskOrder: readonly MomoTaskKind[] = ["crystals", "pattern", "part", "odd", "cables"];
const momoTaskMaximumEncounters: Partial<Record<MomoTaskKind, number>> = {
  cables: 4,
};

function shuffledMomoTaskIndex(level: number, taskCount: number): number {
  const zeroBasedLevel = level - 1;
  const bag = Math.floor(zeroBasedLevel / taskCount);
  const position = zeroBasedLevel % taskCount;
  const direction = bag % 2 === 0 ? 1 : -1;
  const offset = (bag * 2 + Math.floor(bag / 2)) % taskCount;
  return (((offset + direction * position) % taskCount) + taskCount) % taskCount;
}

export function momoTaskForLevel(adaptiveLevel: number): {
  kind: MomoTaskKind;
  encounter: number;
} {
  const finalLevel = Math.max(1, Math.min(150, Math.floor(adaptiveLevel)));
  const encounters: Partial<Record<MomoTaskKind, number>> = {};
  let previousKind: MomoTaskKind | undefined;

  for (let level = 1; level <= finalLevel; level += 1) {
    const available = momoTaskOrder.filter(
      (kind) => (encounters[kind] ?? 0) < (momoTaskMaximumEncounters[kind] ?? Infinity),
    );
    const preferredIndex = shuffledMomoTaskIndex(level, available.length);
    let kind = available[preferredIndex] as MomoTaskKind;
    if (kind === previousKind && available.length > 1) {
      kind = available[(preferredIndex + 1) % available.length] as MomoTaskKind;
    }
    const encounter = (encounters[kind] ?? 0) + 1;
    encounters[kind] = encounter;
    previousKind = kind;
    if (level === finalLevel) return { kind, encounter };
  }

  return { kind: "crystals", encounter: 1 };
}

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

export function momoFaultStageForLevel(adaptiveLevel: number): MomoFaultStage {
  if (adaptiveLevel <= 30) return "shape";
  if (adaptiveLevel <= 60) return "contrast";
  if (adaptiveLevel <= 90) return "near_color";
  if (adaptiveLevel <= 120) return "detail";
  return "two_rules";
}

export function momoRoundsForLevel(
  baseRounds: readonly MomoWorkshopRound[],
  adaptiveLevel: number,
): MomoPlayableRound[] {
  const level = Math.max(1, Math.min(150, Math.floor(adaptiveLevel)));
  const task = momoTaskForLevel(level);
  const occurrence = task.encounter;
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
  const partKinds: MomoPartKind[] = ["antenna", "arm", "battery", "wheel", "sensor"];
  const partChoiceCount = Math.min(5, 2 + occurrence);
  const targetPart = partKinds[(occurrence - 1) % partKinds.length] as MomoPartKind;
  const partRound: MomoBonusRound = {
    id: `momo-part-${level}`,
    kind: "part_match",
    prompt: "Momo'nun eksik parçasının aynısını bul.",
    targetPart,
    choices: [targetPart, ...partKinds.filter((part) => part !== targetPart)].slice(
      0,
      partChoiceCount,
    ),
  };
  const oddChoiceCount = Math.min(25, 4 + occurrence);
  const oddIndex = level % oddChoiceCount;
  const faultStage = momoFaultStageForLevel(level);
  const commonShape: MomoShape = level % 2 === 0 ? "circle" : "square";
  const oddShape: MomoShape = commonShape === "circle" ? "triangle" : "circle";
  const commonPart: MomoFaultyPart = { shape: commonShape, color: "#4B8FE8" };
  const faultyPart: MomoFaultyPart =
    faultStage === "shape"
      ? { ...commonPart, shape: oddShape }
      : faultStage === "contrast"
        ? { ...commonPart, color: "#F37970" }
        : faultStage === "near_color"
          ? { ...commonPart, color: "#679DE8" }
          : faultStage === "detail"
            ? { ...commonPart, marked: true }
            : { shape: oddShape, color: "#679DE8", marked: true };
  const oddRound: MomoBonusRound = {
    id: `momo-odd-${level}`,
    kind: "odd_part",
    prompt:
      faultStage === "two_rules"
        ? "Rengi ve şekli farklı olan arızalı parçayı bul."
        : "Diğerlerinden farklı olan arızalı parçayı bul.",
    stage: faultStage,
    choices: Array.from({ length: oddChoiceCount }, (_, index) =>
      index === oddIndex ? faultyPart : commonPart,
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
          sequence: (() => {
            const cycle: MomoShape[] =
              occurrence <= 2
                ? ["circle", "square"]
                : occurrence <= 4
                  ? ["circle", "circle", "square"]
                  : occurrence <= 6
                    ? ["circle", "square", "square"]
                    : ["circle", "square", "triangle"];
            return Array.from(
              { length: patternLength },
              (_, index) => cycle[index % cycle.length] as MomoShape,
            );
          })(),
          correctShape: (() => {
            const cycle: MomoShape[] =
              occurrence <= 2
                ? ["circle", "square"]
                : occurrence <= 4
                  ? ["circle", "circle", "square"]
                  : occurrence <= 6
                    ? ["circle", "square", "square"]
                    : ["circle", "square", "triangle"];
            return cycle[patternLength % cycle.length] as MomoShape;
          })(),
        }
      : pattern;
  const roundsByTask: Record<MomoTaskKind, MomoPlayableRound | undefined> = {
    crystals: expandedCrystals,
    pattern: expandedPattern,
    part: partRound,
    odd: oddRound,
    cables: expandedCables,
  };
  return [roundsByTask[task.kind] as MomoPlayableRound];
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
