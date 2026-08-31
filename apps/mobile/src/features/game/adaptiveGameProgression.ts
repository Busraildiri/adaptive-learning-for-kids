import type { AgeBand, Game, GameDifficultyLevel, SortObject } from "@adaptive/content-schema";
import { adaptRhythmRound } from "./miniChallengeEngine";

type MiniChallengeContent = Extract<Game, { mechanic: "mini_challenge" }>;
type BalloonGameContent = Extract<Game, { mechanic: "balloon_counting" }>;
type BalloonColor = BalloonGameContent["rounds"][number]["balloons"][number];
type FishGameContent = Extract<Game, { mechanic: "fish_patterns" }>;
type FishColor = Extract<
  FishGameContent["rounds"][number],
  { kind: "sequence_memory" }
>["fish"][number];

const DURU_EMOTION_GAME_ID = "mino-emotion-detective-001";
export const POFI_BALLOON_GAME_ID = "pofi-balloon-counting-001";
export const POFI_BALLOON_MAX_LEVEL = 150;
export const POFI_BALLOON_MAX_COUNT = 12;
export const BOBI_FISH_PATTERN_GAME_ID = "bobi-fish-patterns-2-4-001";
export const BOBI_FISH_MEMORY_GAME_ID = "bobi-fish-memory-4-7-001";
export const BOBI_FISH_MAX_LEVEL = 150;
export const BOBI_FISH_MAX_COUNT = 8;
export const TOKO_MAP_GAME_ID = "toko-little-map-001";
export const TOKO_MAP_ADMIN_GAME_ID = "auto-a4d2abba-2d3e-4152-aca0-cd75bbb8e099";
export const TOKO_MAP_MAX_LEVEL = 60;
export const TOKO_MAP_MAX_MOVES = 8;
export const LILA_LIGHT_GAME_ID = "color-lights-001";
export const LILA_LIGHT_MAX_LEVEL = 5;
export const MAYA_MORNING_GAME_ID = "maya-morning-order-001";
export const MAYA_MORNING_MAX_LEVEL = 20;
export const KIKI_SHOP_GAME_ID = "kiki-big-small-shop-001";
export const KIKI_SHOP_MAX_LEVEL = 20;
const levels: readonly GameDifficultyLevel[] = ["starter", "growing", "advanced"];
const balloonColorNames: Record<BalloonColor, string> = {
  red: "kırmızı",
  blue: "mavi",
  green: "yeşil",
  yellow: "sarı",
  orange: "turuncu",
  purple: "mor",
  pink: "pembe",
  cyan: "turkuaz",
  darkGreen: "koyu yeşil",
  black: "siyah",
  gray: "gri",
  white: "beyaz",
};
const pofiBalloonColors: readonly BalloonColor[] = [
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
  "cyan",
  "darkGreen",
  "black",
  "gray",
  "white",
];
const bobiFishColors: readonly FishColor[] = [
  "red",
  "blue",
  "yellow",
  "teal",
  "green",
  "purple",
  "pink",
  "orange",
];
const tokoDirections = ["up", "right", "down", "left"] as const;
type TokoDirection = (typeof tokoDirections)[number];
const tokoDirectionLabels: Record<TokoDirection, string> = {
  up: "yukarı",
  right: "sağa",
  down: "aşağı",
  left: "sola",
};
const tokoOppositeDirection: Record<TokoDirection, TokoDirection> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};
const tokoRouteCache = new Map<number, TokoDirection[][]>();

export function isTokoMapGameId(gameId: string): boolean {
  return gameId === TOKO_MAP_GAME_ID || gameId === TOKO_MAP_ADMIN_GAME_ID;
}

const turkishObjectCounts: Record<number, string> = {
  1: "bir",
  2: "iki",
  3: "üç",
  4: "dört",
  5: "beş",
  6: "altı",
  7: "yedi",
  8: "sekiz",
  9: "dokuz",
  10: "on",
};

const zuzuPieceCells: Record<string, [number, number][]> = {
  "zuzu-circle": [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  "zuzu-square": [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  "zuzu-triangle": [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  "zuzu-star": [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
};

const zuzuPieceOffsets: Record<string, [number, number]> = {
  "zuzu-circle": [1, 1],
  "zuzu-square": [0, 2],
  "zuzu-triangle": [2, 0],
  "zuzu-star": [0, 1],
};

export function zuzuBoardCellColor(
  column: number,
  row: number,
  palette: readonly string[],
): string {
  return palette[(column + row) % palette.length] ?? palette[0] ?? "#65A7F3";
}

function colorsForZuzuPiece(
  icon: string | undefined,
  boardSize: 4 | 8 | 16,
  palette: readonly string[],
  pieceOffsetColumn?: number,
  pieceOffsetRow?: number,
): string[] {
  if (!icon || palette.length === 0) return [];
  const centerShift = (boardSize - 4) / 2;
  const [defaultOffsetColumn, defaultOffsetRow] = zuzuPieceOffsets[icon] ?? [0, 0];
  const offsetColumn = pieceOffsetColumn ?? defaultOffsetColumn + centerShift;
  const offsetRow = pieceOffsetRow ?? defaultOffsetRow + centerShift;
  return (zuzuPieceCells[icon] ?? []).map(([column, row]) => {
    const boardColumn = column + offsetColumn;
    const boardRow = row + offsetRow;
    return zuzuBoardCellColor(boardColumn, boardRow, palette);
  });
}

const patiAnimalAccusatives: Record<string, string> = {
  "happy-dog": "Köpeği",
  cat: "Kediyi",
  fox: "Tilkiyi",
  rabbit: "Tavşanı",
  bear: "Ayıcığı",
};

const patiCarAccusatives: Record<string, string> = {
  "purple-car": "Mor arabayı",
  "large-green-car": "Yeşil arabayı",
};

const routineStepNames: Record<string, string> = {
  toothbrush: "diş fırçasını",
  pajamas: "pijamayı",
  storybook: "hikâye kitabını",
  bed: "yatağı",
  blocks: "oyuncak bloklarını",
  "toy-basket": "oyuncak sepetini",
  "wash-hands": "ellerini yıkamayı",
  towel: "havluyu",
  coat: "montu",
  shoes: "ayakkabılarını",
  breakfast: "kahvaltıyı",
};

function routineInstructionFor(items: readonly { id: string; label: string }[]): string {
  const steps = items.map(
    (item) =>
      routineStepNames[
        item.id.replace(/-adaptive-\d+$/, "").replace(/-(evening|night|morning|play)$/, "")
      ] ?? item.label,
  );
  if (steps.length === 0) return "Kartları doğru sıraya koy.";
  if (steps.length === 1) return `Önce ${steps[0]}.`;
  if (steps.length === 2) return `Önce ${steps[0]}, sonra ${steps[1]}.`;
  return `Önce ${steps.slice(0, -1).join(", sonra ")}, en son ${steps.at(-1)}.`;
}

// These are the additional illustrated Pati objects. They stay outside the
// five starter rounds, but join the adaptive pool as distinct visuals.
const patiVisualObjects: SortObject[] = [
  {
    id: "cat",
    label: "mavi kedi",
    shape: "bear",
    color: "blue",
    category: "animal",
    size: "small",
  },
  {
    id: "fox",
    label: "kırmızı tilki",
    shape: "bear",
    color: "red",
    category: "animal",
    size: "small",
  },
  {
    id: "rabbit",
    label: "mor tavşan",
    shape: "bear",
    color: "purple",
    category: "animal",
    size: "small",
  },
  {
    id: "bed",
    label: "büyük mavi yatak",
    shape: "block",
    color: "blue",
    category: "toy",
    size: "large",
  },
  {
    id: "pajamas",
    label: "mor pijama",
    shape: "block",
    color: "purple",
    category: "toy",
    size: "small",
  },
  {
    id: "picnic-basket",
    label: "büyük sarı sepet",
    shape: "block",
    color: "yellow",
    category: "toy",
    size: "large",
  },
];
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

export function continuesAfterMaximumLevel(game: Game): boolean {
  return game.mechanic === "momo_workshop";
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

export function pofiBalloonCountForLevel(adaptiveLevel: number): number {
  const normalizedLevel = Math.max(1, Math.min(POFI_BALLOON_MAX_LEVEL, adaptiveLevel));
  return Math.min(POFI_BALLOON_MAX_COUNT, MIN_ADAPTIVE_ITEM_COUNT + normalizedLevel - 1);
}

export function bobiFishCountForLevel(adaptiveLevel: number): number {
  const normalizedLevel = Math.max(1, Math.min(BOBI_FISH_MAX_LEVEL, adaptiveLevel));
  return Math.min(BOBI_FISH_MAX_COUNT, MIN_ADAPTIVE_ITEM_COUNT + normalizedLevel - 1);
}

export function tokoMovementCountForLevel(adaptiveLevel: number): number {
  const normalizedLevel = Math.max(1, Math.min(TOKO_MAP_MAX_LEVEL, adaptiveLevel));
  return Math.min(TOKO_MAP_MAX_MOVES, normalizedLevel);
}

export function lilaRoundCountForLevel(adaptiveLevel: number): number {
  const normalizedLevel = Math.max(1, Math.min(LILA_LIGHT_MAX_LEVEL, adaptiveLevel));
  return normalizedLevel + 1;
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

export function requiredRunsForGame(game: Game, ageBand: AgeBand): number {
  // Riko has five fixed, distinct spatial concepts. Repeating each one just
  // to satisfy the slower 2–4 cadence would make a completed curriculum loop.
  // Pati also has a finite sequence of unique sorting combinations; each
  // completed combination should advance to the next visible level.
  return game.id === "riko-where-001" ||
    game.id === "zuzu-missing-piece-001" ||
    game.id === "rule-changed-garden-001" ||
    game.id === "mino-routine-path-001" ||
    game.id === DURU_EMOTION_GAME_ID ||
    game.id === POFI_BALLOON_GAME_ID ||
    game.id === BOBI_FISH_PATTERN_GAME_ID ||
    game.id === BOBI_FISH_MEMORY_GAME_ID ||
    isTokoMapGameId(game.id) ||
    game.id === LILA_LIGHT_GAME_ID ||
    game.id === MAYA_MORNING_GAME_ID ||
    game.id === KIKI_SHOP_GAME_ID
    ? 1
    : requiredRunsToAdvance(ageBand);
}

export function nextDifficultyAfterCompletion(
  state: AdaptiveProgressionState,
  ageBand: AgeBand,
  maximumLevel = MAX_ADAPTIVE_LEVEL,
  requiredRuns = requiredRunsToAdvance(ageBand),
): AdaptiveProgressionState {
  // A finite game's last available combination is its real finish line. It
  // must not be repeated merely to satisfy the slower 2–4 progression pace.
  if (state.adaptiveLevel >= maximumLevel) {
    return {
      ...state,
      completedRunsAtLevel: 0,
      challengeIndex: state.challengeIndex + 1,
    };
  }
  const completedRunsAtLevel = state.completedRunsAtLevel + 1;
  if (completedRunsAtLevel < requiredRuns) {
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
      combinations = game.id === DURU_EMOTION_GAME_ID ? game.rounds.length : game.rounds.length * 2;
      break;
    case "mini_challenge":
      if (game.id === MAYA_MORNING_GAME_ID) {
        combinations = MAYA_MORNING_MAX_LEVEL;
        break;
      }
      if (game.id === KIKI_SHOP_GAME_ID) {
        combinations = KIKI_SHOP_MAX_LEVEL;
        break;
      }
      if (isTokoMapGameId(game.id)) {
        combinations = TOKO_MAP_MAX_LEVEL;
        break;
      }
      if (game.id === "zuzu-missing-piece-001") {
        combinations = 60;
        break;
      }
      if (game.id === "riko-where-001") {
        combinations = 9;
        break;
      }
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
      if (game.id === "mino-routine-path-001") {
        combinations = game.rounds.length;
        break;
      }
      combinations = game.rounds.reduce(
        (total, round) =>
          total + (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) * round.items.length,
        0,
      );
      break;
    case "fish_patterns":
      if (game.id === BOBI_FISH_PATTERN_GAME_ID || game.id === BOBI_FISH_MEMORY_GAME_ID) {
        combinations = BOBI_FISH_MAX_LEVEL;
        break;
      }
      combinations = game.rounds.reduce(
        (total, round) =>
          total +
          (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) *
            (round.kind === "color_prediction" ? round.choices.length : round.fish.length),
        0,
      );
      break;
    case "balloon_counting":
      if (game.id === POFI_BALLOON_GAME_ID) {
        combinations = POFI_BALLOON_MAX_LEVEL;
        break;
      }
      combinations = game.rounds.reduce(
        (total, round) =>
          total + (MAX_ADAPTIVE_ITEM_COUNT - MIN_ADAPTIVE_ITEM_COUNT + 1) * round.balloons.length,
        0,
      );
      break;
    case "tap_or_wait":
      if (game.id === LILA_LIGHT_GAME_ID) {
        combinations = LILA_LIGHT_MAX_LEVEL;
        break;
      }
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

export function previousZuzuProgression(state: AdaptiveProgressionState): AdaptiveProgressionState {
  const adaptiveLevel = Math.max(1, state.adaptiveLevel - 2);
  return {
    difficulty: difficultyForLevel(adaptiveLevel),
    completedRunsAtLevel: 0,
    itemCount: itemCountForLevel(adaptiveLevel),
    challengeIndex: adaptiveLevel - 1,
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

function pofiBalloonOrder(levelNumber: number, itemCount: number): BalloonColor[] {
  const pool = [...pofiBalloonColors];
  const result: BalloonColor[] = [];
  let permutationIndex = levelNumber - 1;
  while (pool.length > 0) {
    const choiceIndex = permutationIndex % pool.length;
    permutationIndex = Math.floor(permutationIndex / pool.length);
    const [color] = pool.splice(choiceIndex, 1);
    if (color) result.push(color);
  }
  return result.slice(0, itemCount);
}

function bobiFishOrder(levelNumber: number, itemCount = BOBI_FISH_MAX_COUNT): FishColor[] {
  const pool = [...bobiFishColors];
  const result: FishColor[] = [];
  let permutationIndex = levelNumber - 1;
  while (pool.length > 0) {
    const choiceIndex = permutationIndex % pool.length;
    permutationIndex = Math.floor(permutationIndex / pool.length);
    const [color] = pool.splice(choiceIndex, 1);
    if (color) result.push(color);
  }
  return result.slice(0, itemCount);
}

function bobiFishPatternPlan(levelNumber: number): {
  colorCount: number;
  template: readonly number[];
} {
  if (levelNumber <= 20) return { colorCount: 2, template: [0, 1] };
  if (levelNumber < 40) {
    return {
      colorCount: 2,
      template: (levelNumber - 21) % 2 === 0 ? [0, 0, 1] : [1, 1, 0],
    };
  }
  if (levelNumber < 60) return { colorCount: 3, template: [0, 1, 2, 0] };
  return { colorCount: 8, template: [0, 1, 2, 3, 4, 5, 6, 7] };
}

function moveTokoPosition(
  position: { column: number; row: number },
  direction: TokoDirection,
): { column: number; row: number } {
  return {
    column: position.column + (direction === "right" ? 1 : direction === "left" ? -1 : 0),
    row: position.row + (direction === "down" ? 1 : direction === "up" ? -1 : 0),
  };
}

function tokoRoutesForLength(length: number): TokoDirection[][] {
  const cached = tokoRouteCache.get(length);
  if (cached) return cached;
  const routes: TokoDirection[][] = [];
  const visit = (position: { column: number; row: number }, route: TokoDirection[]): void => {
    if (route.length === length) {
      routes.push(route);
      return;
    }
    const previous = route.at(-1);
    for (const direction of tokoDirections) {
      if (previous && direction === tokoOppositeDirection[previous]) continue;
      const next = moveTokoPosition(position, direction);
      if (next.column < 0 || next.column > 2 || next.row < 0 || next.row > 2) continue;
      visit(next, [...route, direction]);
    }
  };
  visit({ column: 1, row: 1 }, []);
  tokoRouteCache.set(length, routes);
  return routes;
}

function tokoRouteForLevel(levelNumber: number, movementCount: number): TokoDirection[] {
  const routes = tokoRoutesForLength(movementCount);
  const firstLevelAtLength = movementCount;
  return routes[(levelNumber - firstLevelAtLength) % routes.length] ?? routes[0] ?? ["right"];
}

function tokoRoutePrompt(route: readonly TokoDirection[]): string {
  const labels = route.map((direction) => tokoDirectionLabels[direction]);
  if (labels.length === 1) return `Bir kez ${labels[0]} dokun.`;
  const last = labels.at(-1);
  const beginning = labels.slice(0, -1).join(", ");
  return `Sırayla ${beginning}${beginning ? " ve " : ""}${last} git.`;
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
    const rikoExtraRounds: MiniChallengeContent["rounds"] =
      game.id === "riko-where-001"
        ? [
            {
              ...game.rounds[0],
              id: "behind",
              prompt: "Resme bak. Top kutunun neresinde saklanıyor?",
              choices: [
                { id: "behind", label: "Arkasında", icon: "riko-left" },
                { id: "front", label: "Önünde", icon: "riko-right" },
              ],
              correctSequence: ["behind"],
            },
            {
              ...game.rounds[0],
              id: "front",
              prompt: "Resme bak. Top kutunun neresinde?",
              choices: [
                { id: "behind", label: "Arkasında", icon: "riko-left" },
                { id: "front", label: "Önünde", icon: "riko-right" },
              ],
              correctSequence: ["front"],
            },
            {
              ...game.rounds[0],
              id: "near",
              prompt: "Resme bak. Top kutuya yakın mı, uzak mı?",
              choices: [
                { id: "near", label: "Yakınında", icon: "riko-left" },
                { id: "far", label: "Uzağında", icon: "riko-right" },
              ],
              correctSequence: ["near"],
            },
            {
              ...game.rounds[0],
              id: "far",
              prompt: "Son resme bak. Top kutuya yakın mı, uzak mı?",
              choices: [
                { id: "near", label: "Yakınında", icon: "riko-left" },
                { id: "far", label: "Uzağında", icon: "riko-right" },
              ],
              correctSequence: ["far"],
            },
          ]
        : [];
    const adaptiveRounds = avoidAdjacentDuplicateAnswers(
      [...game.rounds, ...rikoExtraRounds],
      challengeIndex,
    );
    const adaptiveRound = adaptiveRounds[0];
    if (!adaptiveRound) return game;
    if (game.id === MAYA_MORNING_GAME_ID) {
      const levelNumber = Math.max(
        1,
        Math.min(MAYA_MORNING_MAX_LEVEL, Math.floor(challengeIndex) + 1),
      );
      const sourceRound = game.rounds[(levelNumber - 1) % game.rounds.length];
      if (!sourceRound) return game;
      return {
        ...game,
        rounds: [
          {
            ...sourceRound,
            id: `maya-morning-level-${levelNumber}`,
            choices: rotate(
              sourceRound.choices,
              Math.floor((levelNumber - 1) / game.rounds.length),
            ),
            levelNumber,
            levelCount: MAYA_MORNING_MAX_LEVEL,
          },
        ],
      };
    }
    if (game.id === KIKI_SHOP_GAME_ID) {
      const levelNumber = Math.max(
        1,
        Math.min(KIKI_SHOP_MAX_LEVEL, Math.floor(challengeIndex) + 1),
      );
      const sourceRound = game.rounds[0];
      if (!sourceRound) return game;
      const choiceByIcon = new Map(
        game.rounds.flatMap((round) => round.choices).map((choice) => [choice.icon, choice]),
      );
      const choicePlan = [
        {
          id: "large-apple",
          icon: "kiki-large-apple",
          label: "Büyük elma",
          prompt: "Büyük elmayı bul.",
        },
        {
          id: "small-apple",
          icon: "kiki-small-apple",
          label: "Küçük elma",
          prompt: "Küçük elmayı bul.",
        },
        {
          id: "large-acorn",
          icon: "kiki-large-acorn",
          label: "Büyük palamut",
          prompt: "Büyük palamudu bul.",
        },
        {
          id: "small-acorn",
          icon: "kiki-small-acorn",
          label: "Küçük palamut",
          prompt: "Küçük palamudu bul.",
        },
      ] as const;
      const allChoices = choicePlan.map(({ id, icon, label }) => ({
        ...(choiceByIcon.get(icon) ?? sourceRound.choices[0]),
        id,
        icon,
        label,
      }));
      const targetIndex = (levelNumber - 1) % allChoices.length;
      const target = allChoices[targetIndex];
      const targetPlan = choicePlan[targetIndex];
      if (!target || !targetPlan) return game;
      const optionCount = levelNumber <= 4 ? 2 : levelNumber <= 12 ? 3 : 4;
      const variation = Math.floor((levelNumber - 1) / allChoices.length);
      const distractors = rotate(
        allChoices.filter((choice) => choice.id !== target.id),
        variation,
      );
      const choices = rotate([target, ...distractors.slice(0, optionCount - 1)], variation);
      return {
        ...game,
        rounds: [
          {
            ...sourceRound,
            id: `kiki-shop-level-${levelNumber}`,
            prompt: `${levelNumber === KIKI_SHOP_MAX_LEVEL ? "Son görev! " : ""}${targetPlan.prompt}`,
            choices,
            correctSequence: [target.id],
            levelNumber,
            levelCount: KIKI_SHOP_MAX_LEVEL,
          },
        ],
      };
    }
    if (isTokoMapGameId(game.id)) {
      const levelNumber = Math.max(1, Math.min(TOKO_MAP_MAX_LEVEL, Math.floor(challengeIndex) + 1));
      const movementCount = tokoMovementCountForLevel(levelNumber);
      const correctSequence = tokoRouteForLevel(levelNumber, movementCount);
      const allChoices = Array.from(
        new Map(
          game.rounds.flatMap((round) => round.choices).map((choice) => [choice.id, choice]),
        ).values(),
      );
      const choices = tokoDirections
        .map((direction) => allChoices.find((choice) => choice.id === direction))
        .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice));
      return {
        ...game,
        rounds: [
          {
            ...adaptiveRound,
            id: `toko-map-level-${levelNumber}`,
            prompt: tokoRoutePrompt(correctSequence),
            choices,
            correctSequence,
            demoSequence: undefined,
            levelNumber,
            levelCount: TOKO_MAP_MAX_LEVEL,
          },
        ],
      };
    }
    if (game.id === "zuzu-missing-piece-001") {
      const zuzuLevel = Math.min(60, challengeIndex + 1);
      const isLevelTwenty = zuzuLevel === 20;
      const usesColorMatching = zuzuLevel >= 12;
      const boardSize = zuzuLevel >= 56 ? 16 : zuzuLevel >= 50 ? 8 : 4;
      const shapeOrder = ["circle", "square", "triangle", "star"];
      const targetShape = isLevelTwenty
        ? "square"
        : (shapeOrder[challengeIndex % shapeOrder.length] ?? "circle");
      const zuzuRound =
        game.rounds.find((round) => round.correctSequence[0] === targetShape) ?? adaptiveRound;
      const allZuzuChoices = Array.from(
        new Map(
          game.rounds.flatMap((round) => round.choices).map((choice) => [choice.id, choice]),
        ).values(),
      );
      const correctChoice = allZuzuChoices.find(
        (choice) => choice.id === zuzuRound.correctSequence[0],
      );
      const distractors = rotate(
        allZuzuChoices.filter((choice) => choice.id !== zuzuRound.correctSequence[0]),
        challengeIndex,
      );
      const optionCount = zuzuLevel <= 5 ? 3 : 4;
      const levelColors =
        zuzuLevel >= 56
          ? ["#4C87D9", "#79C9F2", "#72D69B", "#FFD45C", "#FF8A65", "#B388FF"]
          : zuzuLevel >= 35
            ? ["#4C87D9", "#79C9F2", "#72D69B", "#FFD45C"]
            : zuzuLevel >= 20
              ? ["#4C87D9", "#79C9F2", "#72D69B"]
              : zuzuLevel >= 12
                ? ["#4C87D9", "#79C9F2"]
                : ["#65A7F3"];
      const pieceCells = zuzuPieceCells[correctChoice?.icon ?? ""] ?? [];
      const pieceWidth = Math.max(...pieceCells.map(([column]) => column), 0) + 1;
      const pieceHeight = Math.max(...pieceCells.map(([, row]) => row), 0) + 1;
      const maxOffsetColumn = boardSize - pieceWidth;
      const maxOffsetRow = boardSize - pieceHeight;
      const positionVariant =
        Math.floor(challengeIndex / shapeOrder.length) + (isLevelTwenty ? 5 : 0);
      const pieceOffsetColumn = positionVariant % (maxOffsetColumn + 1);
      const pieceOffsetRow =
        Math.floor(positionVariant / (maxOffsetColumn + 1)) % (maxOffsetRow + 1);
      const piecePalette = usesColorMatching
        ? colorsForZuzuPiece(
            correctChoice?.icon,
            boardSize,
            levelColors,
            pieceOffsetColumn,
            pieceOffsetRow,
          )
        : undefined;
      const incorrectPiecePalette = piecePalette?.map(
        (_, index) => piecePalette[(index + 1) % piecePalette.length] ?? piecePalette[0],
      );
      const shapePrompts =
        optionCount === 3
          ? [
              "Eksik parçayı bul ve tabloyu tamamla.",
              "Üç parçadan tabloyu tamamlayanı seç.",
              "Şekle dikkat et. Hangi parça buraya uyar?",
              "Kenarları karşılaştır ve doğru parçayı bul.",
            ]
          : [
              "Dört parçadan tabloyu tamamlayanı bul.",
              "Hangi şekil eksik bölümü tamamlar?",
              "Parçaları karşılaştır ve doğru olanı seç.",
              "Tablodaki eksik şekli dört seçenekten bul.",
            ];
      const colorPrompts = [
        "Şekle ve renk sırasına bak. Uyan parçayı bul.",
        "Renkleri aynı sırada olan doğru parçayı seç.",
        "Hem şekli hem renkleri eşleşen parçayı bul.",
        "Renk örüntüsünü tamamlayan parçayı seç.",
      ];
      const promptPool = usesColorMatching ? colorPrompts : shapePrompts;
      const prompt = isLevelTwenty
        ? "Son örüntüde şekli ve renk sırası aynı olan yatay parçayı bul."
        : (promptPool[challengeIndex % promptPool.length] ?? promptPool[0]);
      const colorDistractor =
        usesColorMatching && correctChoice && incorrectPiecePalette
          ? {
              ...correctChoice,
              id: `${correctChoice.id}-wrong-colors`,
              cellPalette: incorrectPiecePalette,
            }
          : undefined;
      const choices = rotate(
        [correctChoice, colorDistractor, ...distractors]
          .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice))
          .slice(0, optionCount),
        challengeIndex,
      );
      return {
        ...game,
        rounds: [
          {
            ...zuzuRound,
            id: `${zuzuRound.id}-adaptive-${challengeIndex}`,
            boardSize,
            levelNumber: zuzuLevel,
            levelCount: 60,
            pieceOffsetColumn,
            pieceOffsetRow,
            prompt,
            boardPalette: levelColors,
            ...(usesColorMatching
              ? {
                  piecePalette,
                  holePalette: piecePalette,
                }
              : {}),
            choices,
          },
        ],
      };
    }
    if (adaptiveRound.kind === "single") {
      return {
        ...game,
        rounds: [
          {
            ...adaptiveRound,
            id: `${adaptiveRound.id}-adaptive-${challengeIndex}`,
            // Riko is a 2–4 age spatial-language activity. Its answer order is
            // deliberately stable; moving answers is not treated as difficulty.
            choices:
              game.id === "riko-where-001"
                ? adaptiveRound.choices
                : rotate(adaptiveRound.choices, challengeIndex),
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
    if (game.id === BOBI_FISH_PATTERN_GAME_ID) {
      const levelNumber = Math.max(
        1,
        Math.min(BOBI_FISH_MAX_LEVEL, Math.floor(challengeIndex) + 1),
      );
      const visibleCount = bobiFishCountForLevel(levelNumber);
      const orderedColors = bobiFishOrder(levelNumber);
      const patternPlan = bobiFishPatternPlan(levelNumber);
      const patternColors = orderedColors.slice(0, patternPlan.colorCount);
      const patternTemplate = patternPlan.template;
      const sequence = Array.from(
        { length: visibleCount },
        (_, index) => patternColors[patternTemplate[index % patternTemplate.length] ?? 0],
      ).filter((color): color is FishColor => Boolean(color));
      const correctColor =
        patternColors[patternTemplate[visibleCount % patternTemplate.length] ?? 0];
      const distractors = orderedColors.filter((color) => color !== correctColor);
      const choices = rotate(
        [correctColor, ...distractors.slice(0, patternPlan.colorCount - 1)].filter(
          (color): color is FishColor => Boolean(color),
        ),
        levelNumber,
      );
      const sourceRound = game.rounds.find((round) => round.kind === "color_prediction");
      if (!sourceRound || !correctColor) return game;
      return {
        ...game,
        rounds: [
          {
            ...sourceRound,
            id: `bobi-pattern-level-${levelNumber}`,
            sequence,
            choices,
            correctColor,
            prompt: "Balık desenine bak. Sıradaki rengi bul.",
          },
        ],
      };
    }

    if (game.id === BOBI_FISH_MEMORY_GAME_ID) {
      const levelNumber = Math.max(
        1,
        Math.min(BOBI_FISH_MAX_LEVEL, Math.floor(challengeIndex) + 1),
      );
      const visibleCount = bobiFishCountForLevel(levelNumber);
      const fish = bobiFishOrder(levelNumber, visibleCount);
      const sequenceLength = Math.min(visibleCount, 2 + Math.floor((levelNumber - 1) / 20));
      const sequence = rotate(fish, Math.floor((levelNumber - 1) / 8)).slice(0, sequenceLength);
      const sourceRound = game.rounds.find((round) => round.kind === "sequence_memory");
      if (!sourceRound) return game;
      return {
        ...game,
        rounds: [
          {
            ...sourceRound,
            id: `bobi-memory-level-${levelNumber}`,
            fish,
            sequence,
            prompt: `${sequenceLength} balığın parlama sırasını hatırla.`,
            revealMs: Math.max(500, 950 - Math.floor((levelNumber - 1) / 10) * 30),
          },
        ],
      };
    }

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
    if (game.id === POFI_BALLOON_GAME_ID) {
      const levelNumber = Math.max(
        1,
        Math.min(POFI_BALLOON_MAX_LEVEL, Math.floor(challengeIndex) + 1),
      );
      const visibleCount = pofiBalloonCountForLevel(levelNumber);
      const balloons = pofiBalloonOrder(levelNumber, visibleCount);
      const levelGroup = Math.floor((levelNumber - 1) / 3);
      const mode = (levelNumber - 1) % 3;

      if (mode === 1) {
        const sourceRound = game.rounds.find((round) => round.kind === "color");
        const targetColor = balloons[(levelGroup + 1) % visibleCount];
        if (!sourceRound || !targetColor) return game;
        return {
          ...game,
          rounds: [
            {
              ...sourceRound,
              id: `pofi-color-level-${levelNumber}`,
              prompt: `${balloonColorNames[targetColor]} balonu bul ve patlat.`,
              balloons,
              targetCount: 1,
              targetColor,
            },
          ],
        };
      }

      if (mode === 2) {
        const sourceRound = game.rounds.find((round) => round.kind === "order");
        const sequenceLength = Math.min(visibleCount, 2 + (levelGroup % 3));
        const targetOrder = rotate(balloons, levelGroup % visibleCount).slice(0, sequenceLength);
        if (!sourceRound) return game;
        return {
          ...game,
          rounds: [
            {
              ...sourceRound,
              id: `pofi-order-level-${levelNumber}`,
              prompt: `Balonları şu sırayla patlat: ${targetOrder
                .map((color) => balloonColorNames[color])
                .join(", ")}.`,
              balloons,
              targetCount: targetOrder.length,
              targetOrder,
            },
          ],
        };
      }

      const sourceRound = game.rounds.find((round) => round.kind === "count");
      if (!sourceRound) return game;
      const targetCount = Math.min(visibleCount, 2 + (levelGroup % (visibleCount - 1)));
      return {
        ...game,
        rounds: [
          {
            ...sourceRound,
            id: `pofi-count-level-${levelNumber}`,
            prompt: `${targetCount} balonu patlat.`,
            balloons,
            targetCount,
          },
        ],
      };
    }

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
    const sourceObjects = [
      ...game.rounds.flatMap((round) => round.objects),
      ...(game.id === "rule-changed-garden-001" ? patiVisualObjects : []),
    ];
    const objectPool = Array.from(
      new Map(sourceObjects.map((object) => [object.id, object])).values(),
    );
    // A color rule must use an asset whose color is visually unambiguous. For
    // example, the multicolored play ball is not a valid "red" target even
    // though an earlier content record classified it as red.
    const isPatiAnimalRule =
      game.id === "rule-changed-garden-001" &&
      sourceRound.dimension === "category" &&
      sourceRound.targetValue === "animal";
    const matchingPool =
      game.id === "rule-changed-garden-001" && sourceRound.dimension === "color"
        ? sourceRound.objects.filter((object) => object.color === sourceRound.targetValue)
        : isPatiAnimalRule
          ? sourceRound.objects.filter((object) => object.category === "animal")
          : objectPool.filter(
              (object) => object[sourceRound.dimension] === sourceRound.targetValue,
            );
    const matching = rotate(matchingPool, challengeIndex)[0];
    const distractors = rotate(
      objectPool.filter((object) => object[sourceRound.dimension] !== sourceRound.targetValue),
      challengeIndex,
    );
    if (!matching || distractors.length === 0) return game;
    const visibleCount = Math.min(itemCount, distractors.length + 1);
    const objects = rotate(
      [
        { ...matching, id: `${matching.id}-adaptive-target` },
        ...distractors.slice(0, visibleCount - 1).map((object) => ({
          ...object,
          id: `${object.id}-adaptive-distractor`,
        })),
      ],
      challengeIndex,
    );
    const objectCountWord = turkishObjectCounts[objects.length] ?? String(objects.length);
    const instruction =
      game.id === "rule-changed-garden-001" &&
      sourceRound.dimension === "category" &&
      sourceRound.targetValue === "animal"
        ? `${patiAnimalAccusatives[matching.id] ?? matching.label} sepete sürükle ve bırak.`
        : game.id === "rule-changed-garden-001" &&
            sourceRound.dimension === "shape" &&
            sourceRound.targetValue === "car"
          ? `${patiCarAccusatives[matching.id] ?? matching.label} sepete sürükle ve bırak.`
          : sourceRound.instruction
              .replace(/Şimdi dört nesne var\./, `Şimdi ${objectCountWord} nesne var.`)
              .replace(
                /Dört nesnenin içinden/,
                `${objectCountWord.charAt(0).toLocaleUpperCase("tr-TR")}${objectCountWord.slice(1)} nesnenin içinden`,
              );
    return {
      ...game,
      rounds: [
        {
          ...sourceRound,
          id: `${sourceRound.id}-adaptive-${challengeIndex}`,
          instruction,
          objects,
        },
      ],
    };
  }

  if (game.mechanic === "sequence_and_place") {
    const sourceRound = game.rounds[challengeIndex % game.rounds.length];
    if (!sourceRound) return game;
    const sourceItems = sourceRound.items;
    const items = repeatWithUniqueIds(sourceItems, itemCount);
    return {
      ...game,
      rounds: [
        {
          ...sourceRound,
          id: `${sourceRound.id}-adaptive-${challengeIndex}`,
          instruction: routineInstructionFor(items),
          items,
          correctOrder: items.map((item) => item.id),
        },
      ],
    };
  }

  if (game.mechanic === "emotion_clues") {
    const sourceRound =
      game.id === DURU_EMOTION_GAME_ID
        ? game.rounds[challengeIndex % game.rounds.length]
        : avoidAdjacentDuplicateAnswers(game.rounds, challengeIndex)[0];
    if (!sourceRound) return game;
    return {
      ...game,
      rounds: [{ ...sourceRound, id: `${sourceRound.id}-adaptive-${challengeIndex}` }],
      difficulty: {
        ...game.difficulty,
        askClueQuestion: game.id === DURU_EMOTION_GAME_ID || challengeIndex >= game.rounds.length,
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
    const patternCycle = Array.from(new Set([...patternRound.sequence, patternRound.correctShape]));
    const correctShape =
      patternCycle[challengeIndex % patternCycle.length] ?? patternRound.correctShape;
    const visiblePatternLength = Math.max(2, itemCount - 1);
    const targetIndex = patternCycle.indexOf(correctShape);
    const sequenceOffset =
      (targetIndex - visiblePatternLength + patternCycle.length * visiblePatternLength) %
      patternCycle.length;
    const sequence = repeatToLength(rotate(patternCycle, sequenceOffset), visiblePatternLength);
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
          targetCount: 1 + (challengeIndex % itemCount),
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
