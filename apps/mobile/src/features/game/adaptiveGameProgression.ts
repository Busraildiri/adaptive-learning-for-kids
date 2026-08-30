import type { AgeBand, Game, GameDifficultyLevel } from "@adaptive/content-schema";
import { adaptRhythmRound } from "./miniChallengeEngine";

const levels: readonly GameDifficultyLevel[] = ["starter", "growing", "advanced"];
const balloonColorNames = {
  red: "kırmızı",
  blue: "mavi",
  green: "yeşil",
  yellow: "sarı",
  orange: "turuncu",
  purple: "mor",
  pink: "pembe",
  cyan: "turkuaz",
} as const;
export const MIN_ADAPTIVE_ITEM_COUNT = 2;
export const MAX_ADAPTIVE_GRID_AXIS = 5;
export const MAX_ADAPTIVE_ITEM_COUNT = MAX_ADAPTIVE_GRID_AXIS ** 2;
export const MAX_ADAPTIVE_LEVEL = 150;

export type AdaptiveProgressionState = {
  difficulty: GameDifficultyLevel;
  completedRunsAtLevel: number;
  itemCount: number;
  challengeIndex: number;
  adaptiveLevel: number;
};

export function shouldAnnounceGameIntro(runKey: number): boolean {
  return runKey === 0;
}

export function adaptiveGridDimensions(itemCount: number): { columns: number; rows: number } {
  const boundedCount = Math.max(1, Math.min(MAX_ADAPTIVE_ITEM_COUNT, Math.floor(itemCount)));
  const columns = Math.min(MAX_ADAPTIVE_GRID_AXIS, boundedCount);
  return { columns, rows: Math.ceil(boundedCount / columns) };
}

export function createInitialAdaptiveState(
  game: Game,
  progress?: {
    adaptiveLevel?: number;
    challengeIndex?: number;
    completedRunsAtLevel?: number;
  },
): AdaptiveProgressionState {
  const maximumLevel = maxAdaptiveLevelForGame(game);
  const adaptiveLevel = Math.max(1, Math.min(progress?.adaptiveLevel ?? 1, maximumLevel));
  return {
    difficulty: difficultyForLevel(adaptiveLevel),
    completedRunsAtLevel: Math.max(0, progress?.completedRunsAtLevel ?? 0),
    itemCount: itemCountForLevel(adaptiveLevel),
    challengeIndex: Math.max(0, progress?.challengeIndex ?? 0),
    adaptiveLevel,
  };
}

export function itemCountForLevel(adaptiveLevel: number): number {
  const normalizedLevel = Math.max(1, Math.min(MAX_ADAPTIVE_LEVEL, adaptiveLevel));
  return Math.min(
    MAX_ADAPTIVE_ITEM_COUNT,
    MIN_ADAPTIVE_ITEM_COUNT + Math.floor((normalizedLevel - 1) / 6),
  );
}

export function difficultyForLevel(adaptiveLevel: number): GameDifficultyLevel {
  if (adaptiveLevel <= 50) return "starter";
  if (adaptiveLevel <= 100) return "growing";
  return "advanced";
}

export function applyDifficultyLevel(game: Game, difficulty: GameDifficultyLevel): Game {
  return { ...game, difficulty: { ...game.difficulty, level: difficulty } } as Game;
}

export function requiredRunsToAdvance(ageBand: AgeBand): number {
  return ageBand === "2-4" ? 2 : 1;
}

export function nextDifficultyAfterCompletion(
  state: AdaptiveProgressionState,
  ageBand: AgeBand,
  maximumLevel = MAX_ADAPTIVE_LEVEL,
): AdaptiveProgressionState {
  const completedRunsAtLevel = state.completedRunsAtLevel + 1;
  if (completedRunsAtLevel < requiredRunsToAdvance(ageBand)) {
    return { ...state, completedRunsAtLevel, challengeIndex: state.challengeIndex + 1 };
  }
  const adaptiveLevel = Math.min(maximumLevel, state.adaptiveLevel + 1);
  return {
    difficulty: difficultyForLevel(adaptiveLevel),
    completedRunsAtLevel: 0,
    itemCount: itemCountForLevel(adaptiveLevel),
    challengeIndex: state.challengeIndex + 1,
    adaptiveLevel,
  };
}

export function maxAdaptiveLevelForGame(game: Game): number {
  let combinations: number;
  switch (game.mechanic) {
    case "emotion_clues":
      combinations = game.rounds.length * 2;
      break;
    case "mini_challenge":
      if (game.rounds.every((round) => round.kind === "single")) {
        combinations = new Set(
          game.rounds.map((round) =>
            JSON.stringify({ answer: round.correctSequence, display: round.displaySequence }),
          ),
        ).size;
      } else {
        combinations = game.rounds.reduce(
          (total, round) =>
            total +
            (round.kind === "single"
              ? 1
              : (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) * round.choices.length),
          0,
        );
      }
      break;
    case "classify_and_sort":
      combinations = game.rounds.reduce(
        (total, round) =>
          total +
          (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) *
            Math.max(1, round.objects.length - 1),
        0,
      );
      break;
    case "sequence_and_place":
      combinations = game.rounds.reduce(
        (total, round) =>
          total + (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) * round.items.length,
        0,
      );
      break;
    case "fish_patterns":
      combinations = game.rounds.reduce(
        (total, round) =>
          total +
          (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) *
            (round.kind === "color_prediction" ? round.choices.length : round.fish.length),
        0,
      );
      break;
    case "balloon_counting":
      combinations = game.rounds.reduce(
        (total, round) =>
          total + (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) * round.balloons.length,
        0,
      );
      break;
    case "tap_or_wait":
      combinations = Array.from(
        { length: MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1 },
        (_, index) => {
          const length = index + MIN_ADAPTIVE_ITEM_COUNT;
          return game.rules.length * Math.max(1, game.rules.length - 1) ** (length - 1);
        },
      ).reduce((total, count) => Math.min(MAX_ADAPTIVE_LEVEL, total + count), 0);
      break;
    case "momo_workshop":
      combinations =
        (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) *
        game.rounds[2].choices.length *
        new Set(game.rounds[0].endpoints.map((endpoint) => endpoint.matchKey)).size;
      break;
  }
  return Math.max(1, Math.min(MAX_ADAPTIVE_LEVEL, combinations));
}

export function previousProgression(state: AdaptiveProgressionState): AdaptiveProgressionState {
  const adaptiveLevel = Math.max(1, state.adaptiveLevel - 1);
  return {
    difficulty: difficultyForLevel(adaptiveLevel),
    completedRunsAtLevel: 0,
    itemCount: itemCountForLevel(adaptiveLevel),
    challengeIndex: state.challengeIndex + 1,
    adaptiveLevel,
  };
}

function repeatToLength<T>(items: readonly T[], length: number): T[] {
  if (items.length === 0) return [];
  return Array.from({ length }, (_, index) => items[index % items.length] as T);
}

function repeatWithUniqueIds<T extends { id: string }>(items: readonly T[], length: number): T[] {
  return repeatToLength(items, length).map((item, index) => ({
    ...item,
    id: `${item.id}-adaptive-${index}`,
  }));
}

function rotate<T>(items: readonly T[], offset: number): T[] {
  if (items.length === 0) return [];
  const normalizedOffset = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function answerSignature(round: unknown): string {
  if (!round || typeof round !== "object") return JSON.stringify(round);
  const value = round as Record<string, unknown>;
  const answer = {
    targetColor: value.targetColor,
    targetOrder: value.targetOrder,
    correctSequence: value.correctSequence,
    correctColor: value.correctColor,
    correctOrder: value.correctOrder,
    correctEmotion: value.correctEmotion,
    correctClue: value.correctClue,
    targetValue: value.targetValue,
    dimension: value.dimension,
    ruleId: value.ruleId,
    correctAnswer: value.correctAnswer,
  };
  return JSON.stringify(answer);
}

function avoidAdjacentDuplicateAnswers<T>(items: readonly T[], offset: number): T[] {
  const ordered = rotate(items, offset);
  for (let index = 1; index < ordered.length; index += 1) {
    if (answerSignature(ordered[index - 1]) !== answerSignature(ordered[index])) continue;
    const replacementIndex = ordered.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        answerSignature(candidate) !== answerSignature(ordered[index - 1]),
    );
    if (replacementIndex > index) {
      [ordered[index], ordered[replacementIndex]] = [
        ordered[replacementIndex] as T,
        ordered[index] as T,
      ];
    }
  }
  return ordered;
}

function repeatWithoutAdjacentAnswers<T>(items: readonly T[], length: number): T[] {
  if (items.length < 2) return repeatToLength(items, length);
  const result: T[] = [];
  while (result.length < length) {
    const previous = result.at(-1);
    const next = items.find(
      (candidate) => answerSignature(candidate) !== answerSignature(previous),
    );
    result.push((next ?? items[result.length % items.length]) as T);
    items = rotate(items, 1);
  }
  return result;
}

export function adaptGameComplexity(
  game: Game,
  requestedItemCount: number,
  challengeIndex = 0,
): Game {
  const itemCount = Math.max(
    MIN_ADAPTIVE_ITEM_COUNT,
    Math.min(MAX_ADAPTIVE_ITEM_COUNT, Math.floor(requestedItemCount)),
  );

  if (game.mechanic === "mini_challenge") {
    const adaptiveRounds = avoidAdjacentDuplicateAnswers(game.rounds, challengeIndex);
    const adaptiveRound = adaptiveRounds[0];
    if (!adaptiveRound) return game;
    if (adaptiveRound.kind === "single") {
      return {
        ...game,
        rounds: [
          {
            ...adaptiveRound,
            id: `${adaptiveRound.id}-adaptive-${challengeIndex}`,
            choices: rotate(adaptiveRound.choices, challengeIndex),
          },
        ],
      };
    }
    if (adaptiveRound.kind === "rhythm") {
      return {
        ...game,
        rounds: [adaptRhythmRound(adaptiveRound, challengeIndex)],
      };
    }
    const source = adaptiveRound.correctSequence;
    const correctSequence = repeatToLength(rotate(source, challengeIndex), itemCount);
    return {
      ...game,
      rounds: [
        {
          ...adaptiveRound,
          id: `${adaptiveRound.id}-adaptive-${itemCount}`,
          prompt: adaptiveRound.prompt,
          correctSequence,
          demoSequence: undefined,
        },
      ],
    };
  }

  if (game.mechanic === "fish_patterns") {
    if (game.ageBand === "2-4") {
      const rounds = game.rounds.filter((round) => round.kind === "color_prediction");
      const sourceRound = rounds[challengeIndex % rounds.length];
      if (!sourceRound) return game;
      const orderedChoices = rotate(sourceRound.choices, challengeIndex);
      const visiblePatternLength = Math.max(2, itemCount - 1);
      const sequence = repeatToLength(orderedChoices, visiblePatternLength);
      const correctColor =
        orderedChoices[visiblePatternLength % orderedChoices.length] ?? sourceRound.correctColor;
      return {
        ...game,
        rounds: [
          {
            ...sourceRound,
            id: `${sourceRound.id}-adaptive-${challengeIndex}`,
            sequence,
            choices: orderedChoices,
            correctColor,
          },
        ],
      };
    }
    const rounds = game.rounds.filter((round) => round.kind === "sequence_memory");
    const sourceRound = rounds[challengeIndex % rounds.length];
    if (!sourceRound) return game;
    const sequence = repeatToLength(rotate(sourceRound.sequence, challengeIndex), itemCount);
    return {
      ...game,
      rounds: [
        {
          ...sourceRound,
          id: `${sourceRound.id}-adaptive-${challengeIndex}`,
          fish: sequence,
          sequence,
        },
      ],
    };
  }

  if (game.mechanic === "tap_or_wait") {
    const orderedRounds = avoidAdjacentDuplicateAnswers(game.roundPlan.rounds, challengeIndex);
    return {
      ...game,
      roundPlan: {
        ...game.roundPlan,
        rounds: repeatWithoutAdjacentAnswers(orderedRounds, itemCount),
      },
    };
  }

  if (game.mechanic === "balloon_counting") {
    const sourceRound =
      game.rounds[(itemCount - MIN_ADAPTIVE_ITEM_COUNT + challengeIndex) % game.rounds.length];
    if (!sourceRound) return game;
    const palette = sourceRound.balloons;
    const targetOrder: typeof sourceRound.targetOrder =
      sourceRound.kind === "order"
        ? repeatToLength(sourceRound.targetOrder ?? palette, itemCount)
        : sourceRound.targetOrder;
    const targetColor = sourceRound.targetColor ?? palette[0];
    const colorDistractors = targetColor
      ? palette.filter((color) => color !== targetColor)
      : palette;
    const safeColorDistractors: typeof palette =
      colorDistractors.length > 0 ? colorDistractors : targetColor === "red" ? ["blue"] : ["red"];
    const balloons: typeof sourceRound.balloons =
      sourceRound.kind === "order" && targetOrder
        ? rotate(targetOrder, challengeIndex)
        : sourceRound.kind === "color" && targetColor
          ? rotate(
              [targetColor, ...repeatToLength(safeColorDistractors, itemCount - 1)],
              challengeIndex,
            )
          : repeatToLength(rotate(palette, challengeIndex), itemCount);
    const prompt =
      sourceRound.kind === "count"
        ? `${itemCount} balona dokun.`
        : sourceRound.kind === "color" && targetColor
          ? `${balloonColorNames[targetColor]} balona dokun.`
          : targetOrder
            ? `Balonlara şu sırayla dokun: ${targetOrder
                .map((color) => balloonColorNames[color])
                .join(", ")}.`
            : sourceRound.prompt;
    return {
      ...game,
      rounds: [
        {
          ...sourceRound,
          id: `${sourceRound.id}-adaptive-${challengeIndex}`,
          prompt,
          balloons,
          targetCount: sourceRound.kind === "color" ? 1 : itemCount,
          targetColor: sourceRound.kind === "color" ? targetColor : sourceRound.targetColor,
          targetOrder,
        },
      ],
    };
  }

  if (game.mechanic === "classify_and_sort") {
    const sourceRound = game.rounds[challengeIndex % game.rounds.length];
    if (!sourceRound) return game;
    const matching = sourceRound.objects.find(
      (object) => object[sourceRound.dimension] === sourceRound.targetValue,
    );
    const distractors = sourceRound.objects.filter(
      (object) => object[sourceRound.dimension] !== sourceRound.targetValue,
    );
    if (!matching || distractors.length === 0) return game;
    const objects = rotate(
      [
        { ...matching, id: `${matching.id}-adaptive-target` },
        ...repeatWithUniqueIds(rotate(distractors, challengeIndex), itemCount - 1),
      ],
      challengeIndex,
    );
    return {
      ...game,
      rounds: [{ ...sourceRound, id: `${sourceRound.id}-adaptive-${challengeIndex}`, objects }],
    };
  }

  if (game.mechanic === "sequence_and_place") {
    const sourceRound = game.rounds[challengeIndex % game.rounds.length];
    if (!sourceRound) return game;
    const sourceItems = rotate(sourceRound.items, challengeIndex);
    const items = repeatWithUniqueIds(sourceItems, itemCount);
    return {
      ...game,
      rounds: [
        {
          ...sourceRound,
          id: `${sourceRound.id}-adaptive-${challengeIndex}`,
          items,
          correctOrder: items.map((item) => item.id),
        },
      ],
    };
  }

  if (game.mechanic === "emotion_clues") {
    const ordered = avoidAdjacentDuplicateAnswers(game.rounds, challengeIndex);
    const sourceRound = ordered[0];
    if (!sourceRound) return game;
    return {
      ...game,
      rounds: [{ ...sourceRound, id: `${sourceRound.id}-adaptive-${challengeIndex}` }],
      difficulty: {
        ...game.difficulty,
        askClueQuestion: challengeIndex >= game.rounds.length,
      },
    };
  }

  if (game.mechanic === "momo_workshop") {
    const [cableRound, crystalRound, patternRound] = game.rounds;
    const pairCount = Math.max(2, Math.min(MAX_ADAPTIVE_GRID_AXIS, Math.floor(itemCount / 2)));
    const endpointPairs = Array.from({ length: pairCount }, (_, index) => {
      const sourcePair = cableRound.endpoints.filter(
        (endpoint) =>
          endpoint.matchKey ===
          cableRound.endpoints[(index * 2) % cableRound.endpoints.length]?.matchKey,
      );
      const left =
        sourcePair.find((endpoint) => endpoint.side === "left") ?? cableRound.endpoints[0];
      const right =
        sourcePair.find((endpoint) => endpoint.side === "right") ?? cableRound.endpoints[1];
      const matchKey = `adaptive-pair-${index}`;
      return [
        { ...left, id: `${left.id}-adaptive-${index}`, matchKey, side: "left" as const },
        { ...right, id: `${right.id}-adaptive-${index}`, matchKey, side: "right" as const },
      ];
    }).flat();
    const sequence = repeatToLength(
      rotate(patternRound.sequence, challengeIndex),
      Math.max(2, itemCount - 1),
    );
    const correctShape = sequence[sequence.length - 1] ?? patternRound.correctShape;
    const choices = Array.from(
      new Set([correctShape, ...rotate(patternRound.choices, challengeIndex)]),
    );
    return {
      ...game,
      rounds: [
        {
          ...cableRound,
          id: `${cableRound.id}-adaptive-${challengeIndex}`,
          endpoints: rotate(endpointPairs, challengeIndex * 2),
        },
        {
          ...crystalRound,
          id: `${crystalRound.id}-adaptive-${challengeIndex}`,
          crystalCount: itemCount,
          targetCount: itemCount,
        },
        {
          ...patternRound,
          id: `${patternRound.id}-adaptive-${challengeIndex}`,
          sequence,
          choices,
          correctShape,
        },
      ],
    };
  }

  return game;
}

export function previousDifficulty(difficulty: GameDifficultyLevel): GameDifficultyLevel {
  const currentIndex = levels.indexOf(difficulty);
  return levels[Math.max(0, currentIndex - 1)] ?? "starter";
}

export function findGameVariant(
  games: readonly Game[],
  referenceGame: Game,
  difficulty: GameDifficultyLevel,
): Game | undefined {
  const referenceSkillId =
    referenceGame.mechanic === "sequence_and_place" ? referenceGame.leveling?.skillId : undefined;
  return games.find((candidate) => {
    const candidateSkillId =
      candidate.mechanic === "sequence_and_place" ? candidate.leveling?.skillId : undefined;
    return (
      candidate.status === "published" &&
      candidate.mechanic === referenceGame.mechanic &&
      (referenceSkillId
        ? candidateSkillId === referenceSkillId
        : candidate.id === referenceGame.id || candidate.title === referenceGame.title) &&
      candidate.difficulty.level === difficulty
    );
  });
}
