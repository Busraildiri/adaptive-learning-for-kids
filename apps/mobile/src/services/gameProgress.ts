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
};

export type GameProgressMap = Record<string, GameProgress>;

const keyForChild = (childId: string) => `adaptive.game-progress.${childId}`;

export async function loadGameProgress(childId: string): Promise<GameProgressMap> {
  const stored = await SecureStore.getItemAsync(keyForChild(childId));
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as GameProgressMap;
    return Object.fromEntries(
      Object.entries(parsed).map(([gameId, progress]) => [
        gameId,
        {
          ...progress,
          adaptiveLevel: progress.adaptiveLevel ?? 1,
          challengeIndex: progress.challengeIndex ?? 0,
          completedRunsAtLevel: progress.completedRunsAtLevel ?? 0,
          currentDifficulty: progress.currentDifficulty ?? "starter",
        },
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
  const next = { ...current, [progress.gameId]: progress };
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
    challengeIndex: (previous?.challengeIndex ?? 0) + 1,
    completedRunsAtLevel: 0,
    currentDifficulty: "starter",
    updatedAt: new Date().toISOString(),
  });
}
