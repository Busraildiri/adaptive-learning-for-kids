import { z } from "zod";

export const PERSONALIZATION_POLICY_VERSION = "personalization-policy-v1" as const;
export const MINIMUM_DISTINCT_COMPLETED_ACTIVITIES = 5;
export const MINIMUM_CONSISTENT_SIGNAL_SESSIONS = 2;

export const personalizationReasonSchema = z.enum([
  "personalization_disabled",
  "observations_disabled",
  "insufficient_distinct_activities",
  "consistent_help_preference",
  "repeated_activity_preference",
  "general_rotation",
]);

export const personalizedActivityDecisionSchema = z.strictObject({
  selectedActivityId: z.string().trim().min(1).max(100),
  reasonCode: personalizationReasonSchema,
  explanation: z.string().trim().min(1).max(240),
  policyVersion: z.literal(PERSONALIZATION_POLICY_VERSION),
  personalized: z.boolean(),
  eligibleDistinctActivityCount: z.number().int().nonnegative(),
  supportingSessionCount: z.number().int().nonnegative(),
});

export type PersonalizedActivityDecision = z.infer<typeof personalizedActivityDecisionSchema>;

export const personalizationStatusSchema = z.strictObject({
  personalizationEnabled: z.boolean(),
  learningObservationsEnabled: z.boolean(),
  eligibleDistinctActivityCount: z.number().int().nonnegative(),
  requiredDistinctActivityCount: z.literal(MINIMUM_DISTINCT_COMPLETED_ACTIVITIES),
  eligible: z.boolean(),
  policyVersion: z.literal(PERSONALIZATION_POLICY_VERSION),
  lastDecision: z
    .strictObject({
      reasonCode: personalizationReasonSchema,
      explanation: z.string().trim().min(1).max(240),
      personalized: z.boolean(),
      selectedActivityId: z.string().trim().min(1).max(100),
      decidedAt: z.string().datetime({ offset: true }),
    })
    .nullable(),
});

export type PersonalizationStatus = z.infer<typeof personalizationStatusSchema>;

export interface ActivityPersonalizationSignal {
  activityId: string;
  eligibleCompletionCount: number;
  distinctStartSessionCount: number;
  consistentHelpSessionCount: number;
  lastCompletedAt: string | null;
}

export interface PersonalizationDecisionInput {
  personalizationEnabled: boolean;
  learningObservationsEnabled: boolean;
  eligibleDistinctActivityCount: number;
  candidates: ActivityPersonalizationSignal[];
}

function generalRotation(
  candidates: ActivityPersonalizationSignal[],
): ActivityPersonalizationSignal {
  const selected = [...candidates].sort((left, right) => {
    if (left.eligibleCompletionCount !== right.eligibleCompletionCount) {
      return left.eligibleCompletionCount - right.eligibleCompletionCount;
    }
    if (left.lastCompletedAt === null) return -1;
    if (right.lastCompletedAt === null) return 1;
    return left.lastCompletedAt.localeCompare(right.lastCompletedAt);
  })[0];
  if (!selected) throw new Error("At least one candidate activity is required.");
  return selected;
}

export function selectPersonalizedActivity(
  input: PersonalizationDecisionInput,
): PersonalizedActivityDecision {
  if (input.candidates.length === 0) {
    throw new Error("At least one candidate activity is required.");
  }

  let selected = generalRotation(input.candidates);
  let reasonCode: PersonalizedActivityDecision["reasonCode"];
  let explanation: string;
  let personalized = false;
  let supportingSessionCount = 0;

  if (!input.personalizationEnabled) {
    reasonCode = "personalization_disabled";
    explanation = "Kişiselleştirme kapalı olduğu için genel hikâye sırası kullanılıyor.";
  } else if (!input.learningObservationsEnabled) {
    reasonCode = "observations_disabled";
    explanation = "Öğrenme gözlemleri kapalı olduğu için genel hikâye sırası kullanılıyor.";
  } else if (input.eligibleDistinctActivityCount < MINIMUM_DISTINCT_COMPLETED_ACTIVITIES) {
    reasonCode = "insufficient_distinct_activities";
    explanation = "Beş farklı hikâye tamamlanana kadar genel hikâye sırası kullanılıyor.";
  } else {
    const consistentHelp = [...input.candidates]
      .filter(
        (candidate) => candidate.consistentHelpSessionCount >= MINIMUM_CONSISTENT_SIGNAL_SESSIONS,
      )
      .sort((left, right) => right.consistentHelpSessionCount - left.consistentHelpSessionCount)[0];
    const repeatedActivity = [...input.candidates]
      .filter(
        (candidate) =>
          candidate.distinctStartSessionCount >= MINIMUM_CONSISTENT_SIGNAL_SESSIONS &&
          candidate.eligibleCompletionCount > 0,
      )
      .sort((left, right) => right.distinctStartSessionCount - left.distinctStartSessionCount)[0];

    if (consistentHelp) {
      selected = consistentHelp;
      reasonCode = "consistent_help_preference";
      explanation = "Birden fazla oturumda benzer yardım tercihi görülen bir hikâye öne çıkarıldı.";
      personalized = true;
      supportingSessionCount = consistentHelp.consistentHelpSessionCount;
    } else if (repeatedActivity) {
      selected = repeatedActivity;
      reasonCode = "repeated_activity_preference";
      explanation = "Birden fazla oturumda yeniden seçilen bir hikâye öne çıkarıldı.";
      personalized = true;
      supportingSessionCount = repeatedActivity.distinctStartSessionCount;
    } else {
      reasonCode = "general_rotation";
      explanation = "Tutarlı bir tercih oluşmadığı için genel hikâye sırası kullanılıyor.";
    }
  }

  return personalizedActivityDecisionSchema.parse({
    selectedActivityId: selected.activityId,
    reasonCode,
    explanation,
    policyVersion: PERSONALIZATION_POLICY_VERSION,
    personalized,
    eligibleDistinctActivityCount: input.eligibleDistinctActivityCount,
    supportingSessionCount,
  });
}
