import {
  type PersonalizedActivityDecision,
  personalizedActivityDecisionSchema,
} from "@adaptive/personalization-engine";
import { requireSupabase } from "../lib/supabase";

export async function selectNextStory(
  childId: string,
  candidateStoryIds: string[],
): Promise<PersonalizedActivityDecision> {
  const { data, error } = await requireSupabase().rpc("select_personalized_activity", {
    child_profile_id: childId,
    candidate_activity_ids: candidateStoryIds,
  });
  if (error) throw error;
  return personalizedActivityDecisionSchema.parse(data);
}
