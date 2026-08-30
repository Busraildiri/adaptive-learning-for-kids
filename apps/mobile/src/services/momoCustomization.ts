import type { MomoPartVisual } from "@adaptive/content-schema";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

export type MomoCustomization = {
  selectedPart: MomoPartVisual | null;
  unlockedMilestones: number[];
};

const storageKey = (childId: string) => `momo.customization.${childId}`;
const emptyCustomization = (): MomoCustomization => ({
  selectedPart: null,
  unlockedMilestones: [],
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
  return { selectedPart, unlockedMilestones };
}

export async function loadMomoCustomization(childId: string): Promise<MomoCustomization> {
  const localValue = await AsyncStorage.getItem(storageKey(childId));
  let local = emptyCustomization();
  if (localValue) {
    try {
      local = normalizeCustomization(JSON.parse(localValue) as Partial<MomoCustomization>);
    } catch {
      await AsyncStorage.removeItem(storageKey(childId));
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
  await AsyncStorage.setItem(storageKey(childId), JSON.stringify(remote));
  return remote;
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
  await AsyncStorage.setItem(storageKey(childId), JSON.stringify(next));
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
