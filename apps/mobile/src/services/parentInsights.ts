import {
  buildParentSessionSummary,
  PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION,
  type ParentSessionSummary,
  parentInsightEvidenceBundleSchema,
} from "@adaptive/parent-insights";
import {
  type PersonalizationStatus,
  personalizationStatusSchema,
} from "@adaptive/personalization-engine";
import { resolveAgeBand } from "@adaptive/shared-types";
import { requireSupabase } from "../lib/supabase";
import { loadChildConsentSettings } from "./consents";
import { synchronizePendingInteractionEvents } from "./interactionEvents";

function isMissingPersonalizedEvidenceFunction(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "PGRST202" ||
    error.message?.includes("get_personalized_parent_insight_evidence") === true
  );
}

async function loadLegacyEvidenceWithProfileContext(childId: string): Promise<unknown> {
  const client = requireSupabase();
  const [evidenceResult, profileResult, consentSettings] = await Promise.all([
    client.rpc("get_parent_insight_evidence", { child_profile_id: childId }),
    client
      .from("child_profiles")
      .select(
        "nickname, birth_month, birth_year, favorite_animals, favorite_toys, interests, updated_at",
      )
      .eq("id", childId)
      .single(),
    loadChildConsentSettings(childId),
  ]);
  if (evidenceResult.error) throw evidenceResult.error;
  if (profileResult.error) throw profileResult.error;

  const legacyEvidence = evidenceResult.data;
  if (!legacyEvidence || typeof legacyEvidence !== "object" || Array.isArray(legacyEvidence)) {
    throw new Error("Çocuk özeti için geçerli bir kanıt paketi alınamadı.");
  }
  const profile = profileResult.data;
  const includeProfileContext =
    consentSettings.personalization && consentSettings.learning_observations;

  return {
    ...legacyEvidence,
    schemaVersion: 2,
    retrievalPolicyVersion: PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION,
    profileContext: {
      nickname: profile.nickname,
      ageBand: resolveAgeBand(profile.birth_month, profile.birth_year) ?? "outside_supported_range",
      personalizationEnabled: includeProfileContext,
      favoriteAnimals: includeProfileContext ? profile.favorite_animals : [],
      favoriteToys: includeProfileContext ? profile.favorite_toys : [],
      interests: includeProfileContext ? profile.interests : [],
      profileUpdatedAt: profile.updated_at,
    },
  };
}

export async function loadParentSessionSummary(childId: string): Promise<ParentSessionSummary> {
  try {
    await synchronizePendingInteractionEvents();
  } catch (error) {
    // A temporary upload failure must not hide a summary that is already
    // stored. Pending events stay on-device and will be retried later.
    console.warn("[ParentInsights] Pending activity sync failed; loading stored summary", error);
  }
  const { data, error } = await requireSupabase().rpc("get_personalized_parent_insight_evidence", {
    child_profile_id: childId,
  });
  let evidence: unknown = data;
  if (error) {
    if (!isMissingPersonalizedEvidenceFunction(error)) throw error;
    evidence = await loadLegacyEvidenceWithProfileContext(childId);
  }
  return buildParentSessionSummary(parentInsightEvidenceBundleSchema.parse(evidence));
}

export async function loadPersonalizationStatus(childId: string): Promise<PersonalizationStatus> {
  const { data, error } = await requireSupabase().rpc("get_parent_personalization_status", {
    child_profile_id: childId,
  });
  if (error) throw error;
  return personalizationStatusSchema.parse(data);
}
