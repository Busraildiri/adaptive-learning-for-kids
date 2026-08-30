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
});
