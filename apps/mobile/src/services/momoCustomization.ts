import type { MomoPartVisual } from "@adaptive/content-schema";
import { supabase } from "../lib/supabase";

export async function loadMomoCustomization(childId: string): Promise<MomoPartVisual | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("child_momo_customizations")
    .select("selected_part_id")
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw error;
  const selectedPart = data?.selected_part_id;
  return selectedPart === "star-antenna" || selectedPart === "spring-antenna" ? selectedPart : null;
}

export async function saveMomoCustomization(
  childId: string,
  selectedPartId: MomoPartVisual,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("child_momo_customizations").upsert(
    {
      child_id: childId,
      selected_part_id: selectedPartId,
    },
    { onConflict: "child_id" },
  );
  if (error) throw error;
}
