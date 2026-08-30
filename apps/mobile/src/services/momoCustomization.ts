import type { MomoPartVisual } from "@adaptive/content-schema";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../lib/supabase";

export type MomoCustomization = {
  selectedPart: MomoPartVisual | null;
  unlockedMilestones: number[];
  completedChapterIds: string[];
};

const storageKey = (childId: string) => `momo.customization.${childId}`;
const emptyCustomization = (): MomoCustomization => ({
  selectedPart: null,
  unlockedMilestones: [],
  completedChapterIds: [],
});

function normalizeCustomization(value: Partial<MomoCustomization> | null): MomoCustomization {
  const selectedPart =
    value?.selectedPart === "star-antenna" || value?.selectedPart === "spring-antenna"
      ? value.selectedPart
      : null;
  const unlockedMilestones = Array.from(
    new Set(
      (value?.unlockedMilestones ?? []).filter(
        (level) => Number.isInteger(level) && level >= 10 && level <= 150 && level % 10 === 0,
      ),
    ),
  ).sort((left, right) => left - right);
  const completedChapterIds = Array.from(
    new Set(
      (value?.completedChapterIds ?? []).filter(
        (chapterId) =>
          typeof chapterId === "string" && chapterId.length > 0 && chapterId.length <= 160,
      ),
    ),
  ).slice(-150);
  return { selectedPart, unlockedMilestones, completedChapterIds };
}

export async function loadMomoCustomization(childId: string): Promise<MomoCustomization> {
  const localValue = await SecureStore.getItemAsync(storageKey(childId));
  let local = emptyCustomization();
  if (localValue) {
    try {
      local = normalizeCustomization(JSON.parse(localValue) as Partial<MomoCustomization>);
    } catch {
      await SecureStore.deleteItemAsync(storageKey(childId));
    }
  }
  if (!supabase) return local;
  const { data, error } = await supabase
    .from("child_momo_customizations")
    .select("selected_part_id, unlocked_milestones")
    .eq("child_id", childId)
    .maybeSingle();
  if (error || !data) return local;
  const remote = normalizeCustomization({
    selectedPart: data.selected_part_id,
    unlockedMilestones: data.unlocked_milestones,
  });
  await SecureStore.setItemAsync(storageKey(childId), JSON.stringify(remote), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return {
    ...remote,
    completedChapterIds: Array.from(
      new Set([...local.completedChapterIds, ...remote.completedChapterIds]),
    ).slice(-150),
  };
}

export async function markMomoChapterCompleted(childId: string, chapterId: string): Promise<void> {
  const current = await loadMomoCustomization(childId);
  const next = normalizeCustomization({
    ...current,
    completedChapterIds: [...current.completedChapterIds, chapterId],
  });
  await SecureStore.setItemAsync(storageKey(childId), JSON.stringify(next), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function saveMomoCustomization(
  childId: string,
  selectedPartId: MomoPartVisual,
  milestoneLevel: number,
): Promise<void> {
  const current = await loadMomoCustomization(childId);
  const next = normalizeCustomization({
    selectedPart: selectedPartId,
    unlockedMilestones: [...current.unlockedMilestones, milestoneLevel],
  });
  await SecureStore.setItemAsync(storageKey(childId), JSON.stringify(next), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!supabase) return;
  const { error } = await supabase.from("child_momo_customizations").upsert(
    {
      child_id: childId,
      selected_part_id: selectedPartId,
      unlocked_milestones: next.unlockedMilestones,
    },
    { onConflict: "child_id" },
  );
  if (error) throw error;
}
