import type { GameDifficultyLevel } from "@adaptive/content-schema";
import * as SecureStore from "expo-secure-store";

export type GameProgress = {
  gameId: string;
  maxItemCount: number;
  completed: boolean;
  replayCount: number;
  adaptiveLevel: number;
  challengeIndex: number;
  completedRunsAtLevel: number;
  currentDifficulty: GameDifficultyLevel;
  updatedAt: string;
  rhythmProgressionVersion?: number;
  zuzuProgressionVersion?: number;
  duruEmotionProgressionVersion?: number;
  pofiBalloonProgressionVersion?: number;
  bobiFishPatternProgressionVersion?: number;
  bobiFishMemoryProgressionVersion?: number;
  tokoMapProgressionVersion?: number;
  lilaLightProgressionVersion?: number;
  mayaMorningProgressionVersion?: number;
  kikiShopProgressionVersion?: number;
};

export type GameProgressMap = Record<string, GameProgress>;

const keyForChild = (childId: string) => `adaptive.game-progress.${childId}`;
const NINO_GAME_ID = "nino-sound-rhythm-001";
const NINO_RHYTHM_PROGRESSION_VERSION = 1;
const ZUZU_GAME_ID = "zuzu-missing-piece-001";
const ZUZU_PROGRESSION_VERSION = 6;
const DURU_GAME_ID = "mino-emotion-detective-001";
const DURU_EMOTION_PROGRESSION_VERSION = 1;
const POFI_GAME_ID = "pofi-balloon-counting-001";
const POFI_BALLOON_PROGRESSION_VERSION = 2;
const BOBI_FISH_PATTERN_GAME_ID = "bobi-fish-patterns-2-4-001";
const BOBI_FISH_PATTERN_PROGRESSION_VERSION = 1;
const BOBI_FISH_MEMORY_GAME_ID = "bobi-fish-memory-4-7-001";
const BOBI_FISH_MEMORY_PROGRESSION_VERSION = 1;
const TOKO_MAP_GAME_ID = "toko-little-map-001";
const TOKO_MAP_ADMIN_GAME_ID = "auto-a4d2abba-2d3e-4152-aca0-cd75bbb8e099";
const TOKO_MAP_PROGRESSION_VERSION = 1;
const LILA_LIGHT_GAME_ID = "color-lights-001";
const LILA_LIGHT_PROGRESSION_VERSION = 1;
const MAYA_MORNING_GAME_ID = "maya-morning-order-001";
const MAYA_MORNING_PROGRESSION_VERSION = 1;
const KIKI_SHOP_GAME_ID = "kiki-big-small-shop-001";
const KIKI_SHOP_PROGRESSION_VERSION = 1;

const isTokoMapGameId = (gameId: string) =>
  gameId === TOKO_MAP_GAME_ID || gameId === TOKO_MAP_ADMIN_GAME_ID;

export function shouldRestartGameOnLaunch(gameId: string, progress?: GameProgress): boolean {
  return gameId === NINO_GAME_ID || Boolean(progress?.completed);
}

export function normalizeGameProgress(gameId: string, progress: GameProgress): GameProgress {
  const normalized = {
    ...progress,
    adaptiveLevel: progress.adaptiveLevel ?? 1,
    challengeIndex: progress.challengeIndex ?? 0,
    completedRunsAtLevel: progress.completedRunsAtLevel ?? 0,
    currentDifficulty: progress.currentDifficulty ?? "starter",
  };

  if (
    gameId === NINO_GAME_ID &&
    progress.rhythmProgressionVersion !== NINO_RHYTHM_PROGRESSION_VERSION
  ) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      rhythmProgressionVersion: NINO_RHYTHM_PROGRESSION_VERSION,
    };
  }

  if (gameId === ZUZU_GAME_ID && progress.zuzuProgressionVersion !== ZUZU_PROGRESSION_VERSION) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      zuzuProgressionVersion: ZUZU_PROGRESSION_VERSION,
    };
  }

  if (
    gameId === DURU_GAME_ID &&
    progress.duruEmotionProgressionVersion !== DURU_EMOTION_PROGRESSION_VERSION
  ) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      duruEmotionProgressionVersion: DURU_EMOTION_PROGRESSION_VERSION,
    };
  }

  if (
    gameId === POFI_GAME_ID &&
    progress.pofiBalloonProgressionVersion !== POFI_BALLOON_PROGRESSION_VERSION
  ) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      pofiBalloonProgressionVersion: POFI_BALLOON_PROGRESSION_VERSION,
    };
  }

  if (
    gameId === BOBI_FISH_PATTERN_GAME_ID &&
    progress.bobiFishPatternProgressionVersion !== BOBI_FISH_PATTERN_PROGRESSION_VERSION
  ) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      bobiFishPatternProgressionVersion: BOBI_FISH_PATTERN_PROGRESSION_VERSION,
    };
  }

  if (
    gameId === BOBI_FISH_MEMORY_GAME_ID &&
    progress.bobiFishMemoryProgressionVersion !== BOBI_FISH_MEMORY_PROGRESSION_VERSION
  ) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      bobiFishMemoryProgressionVersion: BOBI_FISH_MEMORY_PROGRESSION_VERSION,
    };
  }

  if (
    isTokoMapGameId(gameId) &&
    progress.tokoMapProgressionVersion !== TOKO_MAP_PROGRESSION_VERSION
  ) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      tokoMapProgressionVersion: TOKO_MAP_PROGRESSION_VERSION,
    };
  }

  const finiteCurriculumVersion =
    gameId === LILA_LIGHT_GAME_ID
      ? ["lilaLightProgressionVersion", LILA_LIGHT_PROGRESSION_VERSION]
      : gameId === MAYA_MORNING_GAME_ID
        ? ["mayaMorningProgressionVersion", MAYA_MORNING_PROGRESSION_VERSION]
        : gameId === KIKI_SHOP_GAME_ID
          ? ["kikiShopProgressionVersion", KIKI_SHOP_PROGRESSION_VERSION]
          : undefined;
  if (
    finiteCurriculumVersion &&
    progress[finiteCurriculumVersion[0] as keyof GameProgress] !== finiteCurriculumVersion[1]
  ) {
    return {
      ...normalized,
      maxItemCount: 2,
      completed: false,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      [finiteCurriculumVersion[0]]: finiteCurriculumVersion[1],
    };
  }

  return normalized;
}

export async function loadGameProgress(childId: string): Promise<GameProgressMap> {
  const stored = await SecureStore.getItemAsync(keyForChild(childId));
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as GameProgressMap;
    return Object.fromEntries(
      Object.entries(parsed).map(([gameId, progress]) => [
        gameId,
        normalizeGameProgress(gameId, progress),
      ]),
    );
  } catch {
    return {};
  }
}

export async function saveGameProgress(
  childId: string,
  progress: GameProgress,
): Promise<GameProgressMap> {
  const current = await loadGameProgress(childId);
  let versionedProgress = progress;
  if (progress.gameId === NINO_GAME_ID) {
    versionedProgress = {
      ...progress,
      rhythmProgressionVersion: NINO_RHYTHM_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === ZUZU_GAME_ID) {
    versionedProgress = {
      ...progress,
      zuzuProgressionVersion: ZUZU_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === DURU_GAME_ID) {
    versionedProgress = {
      ...progress,
      duruEmotionProgressionVersion: DURU_EMOTION_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === POFI_GAME_ID) {
    versionedProgress = {
      ...progress,
      pofiBalloonProgressionVersion: POFI_BALLOON_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === BOBI_FISH_PATTERN_GAME_ID) {
    versionedProgress = {
      ...progress,
      bobiFishPatternProgressionVersion: BOBI_FISH_PATTERN_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === BOBI_FISH_MEMORY_GAME_ID) {
    versionedProgress = {
      ...progress,
      bobiFishMemoryProgressionVersion: BOBI_FISH_MEMORY_PROGRESSION_VERSION,
    };
  } else if (isTokoMapGameId(progress.gameId)) {
    versionedProgress = {
      ...progress,
      tokoMapProgressionVersion: TOKO_MAP_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === LILA_LIGHT_GAME_ID) {
    versionedProgress = {
      ...progress,
      lilaLightProgressionVersion: LILA_LIGHT_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === MAYA_MORNING_GAME_ID) {
    versionedProgress = {
      ...progress,
      mayaMorningProgressionVersion: MAYA_MORNING_PROGRESSION_VERSION,
    };
  } else if (progress.gameId === KIKI_SHOP_GAME_ID) {
    versionedProgress = {
      ...progress,
      kikiShopProgressionVersion: KIKI_SHOP_PROGRESSION_VERSION,
    };
  }
  const next = { ...current, [progress.gameId]: versionedProgress };
  await SecureStore.setItemAsync(keyForChild(childId), JSON.stringify(next), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return next;
}

export async function restartCompletedGame(
  childId: string,
  gameId: string,
): Promise<GameProgressMap> {
  const current = await loadGameProgress(childId);
  const previous = current[gameId];
  return saveGameProgress(childId, {
    gameId,
    maxItemCount: 2,
    completed: false,
    replayCount: (previous?.replayCount ?? 0) + (previous?.completed ? 1 : 0),
    adaptiveLevel: 1,
    challengeIndex:
      gameId === NINO_GAME_ID ||
      gameId === ZUZU_GAME_ID ||
      gameId === DURU_GAME_ID ||
      gameId === POFI_GAME_ID ||
      gameId === BOBI_FISH_PATTERN_GAME_ID ||
      gameId === BOBI_FISH_MEMORY_GAME_ID ||
      isTokoMapGameId(gameId) ||
      gameId === LILA_LIGHT_GAME_ID ||
      gameId === MAYA_MORNING_GAME_ID ||
      gameId === KIKI_SHOP_GAME_ID
        ? 0
        : (previous?.challengeIndex ?? 0) + 1,
    completedRunsAtLevel: 0,
    currentDifficulty: "starter",
    updatedAt: new Date().toISOString(),
  });
}
