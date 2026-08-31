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

  it.each([
    ["bobi-fish-patterns-2-4-001", "bobiFishPatternProgressionVersion"],
    ["bobi-fish-memory-4-7-001", "bobiFishMemoryProgressionVersion"],
  ] as const)("resets old %s progress once for the 150-level fish curriculum", (gameId, key) => {
    const oldProgress: GameProgress = {
      ...savedProgress,
      gameId,
      completed: false,
    };

    expect(normalizeGameProgress(gameId, oldProgress)).toMatchObject({
      maxItemCount: 2,
      completed: false,
      replayCount: 2,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      [key]: 1,
    });
  });

  it.each([
    ["bobi-fish-patterns-2-4-001", "bobiFishPatternProgressionVersion"],
    ["bobi-fish-memory-4-7-001", "bobiFishMemoryProgressionVersion"],
  ] as const)("keeps %s progress after its fish migration", (gameId, key) => {
    const migrated = {
      ...savedProgress,
      gameId,
      completed: false,
      [key]: 1,
    };

    expect(normalizeGameProgress(gameId, migrated)).toEqual(migrated);
  });

  it("resets old Toko progress once for the growing map curriculum", () => {
    const oldTokoProgress: GameProgress = {
      ...savedProgress,
      gameId: "toko-little-map-001",
      completed: false,
    };

    expect(normalizeGameProgress(oldTokoProgress.gameId, oldTokoProgress)).toMatchObject({
      maxItemCount: 2,
      completed: false,
      replayCount: 2,
      adaptiveLevel: 1,
      challengeIndex: 0,
      completedRunsAtLevel: 0,
      currentDifficulty: "starter",
      tokoMapProgressionVersion: 1,
    });
  });

  it("keeps Toko progress after the map curriculum migration", () => {
    const migratedToko: GameProgress = {
      ...savedProgress,
      gameId: "toko-little-map-001",
      completed: false,
      tokoMapProgressionVersion: 1,
    };

    expect(normalizeGameProgress(migratedToko.gameId, migratedToko)).toEqual(migratedToko);
  });

  it.each([
    ["color-lights-001", "lilaLightProgressionVersion"],
    ["maya-morning-order-001", "mayaMorningProgressionVersion"],
    ["kiki-big-small-shop-001", "kikiShopProgressionVersion"],
  ] as const)("resets old %s progress once for its finite curriculum", (gameId, versionKey) => {
    const oldProgress: GameProgress = { ...savedProgress, gameId, completed: false };

    expect(normalizeGameProgress(gameId, oldProgress)).toMatchObject({
      adaptiveLevel: 1,
      challengeIndex: 0,
      completed: false,
      completedRunsAtLevel: 0,
      [versionKey]: 1,
    });
  });

  it.each([
    ["color-lights-001", "lilaLightProgressionVersion"],
    ["maya-morning-order-001", "mayaMorningProgressionVersion"],
    ["kiki-big-small-shop-001", "kikiShopProgressionVersion"],
  ] as const)("keeps %s progress after its finite curriculum migration", (gameId, versionKey) => {
    const migrated = { ...savedProgress, gameId, completed: false, [versionKey]: 1 };

    expect(normalizeGameProgress(gameId, migrated)).toEqual(migrated);
  });
});
