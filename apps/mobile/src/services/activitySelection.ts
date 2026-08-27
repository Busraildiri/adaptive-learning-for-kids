import type { ActivityDecision } from "@adaptive/evidence-engine";
import { requireSupabase } from "../lib/supabase";

function isActivityDecision(value: unknown): value is ActivityDecision {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.selectedActivityId === "string" &&
    typeof candidate.reasonCode === "string" &&
    typeof candidate.explanation === "string" &&
    typeof candidate.thresholdVersion === "string"
  );
}

export async function selectNextStory(
  childId: string,
  candidateStoryIds: string[],
): Promise<ActivityDecision> {
  const { data, error } = await requireSupabase().rpc("select_next_activity", {
    child_profile_id: childId,
    candidate_activity_ids: candidateStoryIds,
  });
  if (error) throw error;
  if (!isActivityDecision(data)) throw new Error("Etkinlik önerisi anlaşılamadı.");
  return data;
}
