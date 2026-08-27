import { type ParentSessionSummary, parentSessionSummarySchema } from "@adaptive/parent-insights";
import {
  type PersonalizationStatus,
  personalizationStatusSchema,
} from "@adaptive/personalization-engine";
import { requireSupabase } from "../lib/supabase";

export async function loadParentSessionSummary(childId: string): Promise<ParentSessionSummary> {
  const { data, error } = await requireSupabase().rpc("get_parent_session_summary", {
    child_profile_id: childId,
  });
  if (error) throw error;
  return parentSessionSummarySchema.parse(data);
}

export async function loadPersonalizationStatus(childId: string): Promise<PersonalizationStatus> {
  const { data, error } = await requireSupabase().rpc("get_parent_personalization_status", {
    child_profile_id: childId,
  });
  if (error) throw error;
  return personalizationStatusSchema.parse(data);
}
