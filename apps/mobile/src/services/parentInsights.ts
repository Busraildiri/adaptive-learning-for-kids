import {
  buildParentSessionSummary,
  type ParentSessionSummary,
  parentInsightEvidenceBundleSchema,
} from "@adaptive/parent-insights";
import {
  type PersonalizationStatus,
  personalizationStatusSchema,
} from "@adaptive/personalization-engine";
import { requireSupabase } from "../lib/supabase";
import { synchronizePendingInteractionEvents } from "./interactionEvents";

export async function loadParentSessionSummary(childId: string): Promise<ParentSessionSummary> {
  await synchronizePendingInteractionEvents();
  const { data, error } = await requireSupabase().rpc("get_parent_insight_evidence", {
    child_profile_id: childId,
  });
  if (error) throw error;
  return buildParentSessionSummary(parentInsightEvidenceBundleSchema.parse(data));
}

export async function loadPersonalizationStatus(childId: string): Promise<PersonalizationStatus> {
  const { data, error } = await requireSupabase().rpc("get_parent_personalization_status", {
    child_profile_id: childId,
  });
  if (error) throw error;
  return personalizationStatusSchema.parse(data);
}
