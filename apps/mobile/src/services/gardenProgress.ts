import * as SecureStore from "expo-secure-store";

export type GardenProgress = {
  /** Number of visual rewards that are already part of the child's garden (0–27). */
  placedCount: number;
  appleTreeStage: number;
  updatedAt: string;
};

const keyForChild = (childId: string) => `adaptive.surpriz-bahcem.${childId}`;

export async function loadGardenProgress(childId: string): Promise<GardenProgress> {
  const stored = await SecureStore.getItemAsync(keyForChild(childId));
  if (!stored) return { placedCount: 0, appleTreeStage: 0, updatedAt: new Date(0).toISOString() };
  try {
    const parsed = JSON.parse(stored) as Partial<GardenProgress> & {
      appleTreeWatered?: boolean;
    };
    return {
      placedCount: Math.max(0, Math.min(27, Math.floor(parsed.placedCount ?? 0))),
      appleTreeStage: Math.max(
        0,
        Math.min(2, Math.floor(parsed.appleTreeStage ?? (parsed.appleTreeWatered ? 1 : 0))),
      ),
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return { placedCount: 0, appleTreeStage: 0, updatedAt: new Date(0).toISOString() };
  }
}

export async function saveGardenProgress(
  childId: string,
  placedCount: number,
  appleTreeStage = 0,
): Promise<void> {
  await SecureStore.setItemAsync(
    keyForChild(childId),
    JSON.stringify({
      placedCount: Math.max(0, Math.min(27, placedCount)),
      appleTreeStage: Math.max(0, Math.min(2, appleTreeStage)),
      updatedAt: new Date().toISOString(),
    }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
}
