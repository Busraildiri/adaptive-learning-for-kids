import {
  type ChildConsentSettings,
  CONSENT_NOTICE_VERSIONS,
  type ConsentType,
  createFailClosedChildConsentSettings,
} from "@adaptive/shared-types";
import { requireSupabase } from "../lib/supabase";
import { clearPendingInteractionEventsForChild } from "./interactionEvents";

export async function loadChildConsentSettings(childId: string): Promise<ChildConsentSettings> {
  const { data, error } = await requireSupabase()
    .from("child_consent_preferences")
    .select("consent_type, enabled")
    .eq("child_id", childId);

  if (error) throw error;

  const settings = createFailClosedChildConsentSettings();
  for (const preference of data) {
    settings[preference.consent_type] = preference.enabled;
  }

  return settings;
}

export async function setChildConsent(
  childId: string,
  consentType: Exclude<ConsentType, "personalization">,
  enabled: boolean,
): Promise<void> {
  const { error } = await requireSupabase().rpc("set_child_consent", {
    child_profile_id: childId,
    consent_kind: consentType,
    is_enabled: enabled,
    consent_notice_version: CONSENT_NOTICE_VERSIONS[consentType],
  });

  if (error) throw error;

  if (consentType === "learning_observations" && !enabled) {
    await clearPendingInteractionEventsForChild(childId);
  }
}

export async function setChildPersonalization(
  childId: string,
  enabled: boolean,
  optionalProfileData: {
    favoriteAnimals: string[];
    favoriteToys: string[];
    interests: string[];
  },
): Promise<void> {
  const { error } = await requireSupabase().rpc("set_child_personalization", {
    child_profile_id: childId,
    is_enabled: enabled,
    consent_notice_version: CONSENT_NOTICE_VERSIONS.personalization,
    favorite_animals: enabled ? optionalProfileData.favoriteAnimals : [],
    favorite_toys: enabled ? optionalProfileData.favoriteToys : [],
    interests: enabled ? optionalProfileData.interests : [],
  });

  if (error) throw error;
}
