import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
}));

import {
  type GameProgress,
  normalizeGameProgress,
  shouldRestartGameOnLaunch,
} from "./gameProgress";

const savedProgress: GameProgress = {
  gameId: "nino-sound-rhythm-001",
  maxItemCount: 12,
  completed: true,
  replayCount: 2,
  adaptiveLevel: 40,
  challengeIndex: 18,
  completedRunsAtLevel: 1,
  currentDifficulty: "advanced",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

describe("game progress migration", () => {
  it("resets old Nino progress once for the new rhythm curriculum", () => {
    expect(normalizeGameProgress(savedProgress.gameId, savedProgress)).toMatchObject({
      maxItemCount: 2,
      completed: false,
      replayCount: 2,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      rhythmProgressionVersion: 1,
    });
  });

  it("keeps Nino progress after the curriculum migration has been applied", () => {
    const migrated = { ...savedProgress, rhythmProgressionVersion: 1 };

    expect(normalizeGameProgress(migrated.gameId, migrated)).toEqual(migrated);
  });

  it("starts every new Nino session from the two-sound round", () => {
    const inProgress = { ...savedProgress, completed: false, rhythmProgressionVersion: 1 };

    expect(shouldRestartGameOnLaunch(inProgress.gameId, inProgress)).toBe(true);
    expect(shouldRestartGameOnLaunch("another-game", inProgress)).toBe(false);
    expect(shouldRestartGameOnLaunch("another-game", { ...inProgress, completed: true })).toBe(
      true,
    );
  });

  it("resets old Duru progress once for the finite emotion curriculum", () => {
    const oldDuruProgress: GameProgress = {
      ...savedProgress,
      gameId: "mino-emotion-detective-001",
      completed: false,
    };

    expect(normalizeGameProgress(oldDuruProgress.gameId, oldDuruProgress)).toMatchObject({
      maxItemCount: 2,
      completed: false,
      replayCount: 2,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      duruEmotionProgressionVersion: 1,
    });
  });

  it("keeps Duru progress after the curriculum migration has been applied", () => {
    const migratedDuru: GameProgress = {
      ...savedProgress,
      gameId: "mino-emotion-detective-001",
      completed: false,
      duruEmotionProgressionVersion: 1,
    };

    expect(normalizeGameProgress(migratedDuru.gameId, migratedDuru)).toEqual(migratedDuru);
  });

  it("resets old Pofi progress once for the 150-level balloon curriculum", () => {
    const oldPofiProgress: GameProgress = {
      ...savedProgress,
      gameId: "pofi-balloon-counting-001",
      completed: false,
    };

    expect(normalizeGameProgress(oldPofiProgress.gameId, oldPofiProgress)).toMatchObject({
      maxItemCount: 2,
      completed: false,
      replayCount: 2,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      pofiBalloonProgressionVersion: 2,
    });
  });

  it("keeps Pofi progress after the balloon curriculum migration has been applied", () => {
    const migratedPofi: GameProgress = {
      ...savedProgress,
      gameId: "pofi-balloon-counting-001",
      completed: false,
      pofiBalloonProgressionVersion: 2,
    };

    expect(normalizeGameProgress(migratedPofi.gameId, migratedPofi)).toEqual(migratedPofi);
  });
});
