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
};

export type GameProgressMap = Record<string, GameProgress>;

const keyForChild = (childId: string) => `adaptive.game-progress.${childId}`;
const NINO_GAME_ID = "nino-sound-rhythm-001";
const NINO_RHYTHM_PROGRESSION_VERSION = 1;
const ZUZU_GAME_ID = "zuzu-missing-piece-001";
const ZUZU_PROGRESSION_VERSION = 6;

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
  const versionedProgress =
    progress.gameId === NINO_GAME_ID
      ? {
          ...progress,
          rhythmProgressionVersion: NINO_RHYTHM_PROGRESSION_VERSION,
        }
      : progress.gameId === ZUZU_GAME_ID
        ? { ...progress, zuzuProgressionVersion: ZUZU_PROGRESSION_VERSION }
        : progress;
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
      gameId === NINO_GAME_ID || gameId === ZUZU_GAME_ID ? 0 : (previous?.challengeIndex ?? 0) + 1,
    completedRunsAtLevel: 0,
    currentDifficulty: "starter",
    updatedAt: new Date().toISOString(),
  });
}
