import type { BktLeveling, GameDifficultyLevel } from "@adaptive/content-schema";
import { z } from "zod";

export const PERSONALIZATION_POLICY_VERSION = "personalization-policy-v1" as const;
export const MINIMUM_DISTINCT_COMPLETED_ACTIVITIES = 5;
export const MINIMUM_CONSISTENT_SIGNAL_SESSIONS = 2;
export const GAME_PERSONALIZATION_POLICY_VERSION = "game-personalization-policy-v1" as const;
export const MINIMUM_GAME_PERSONALIZATION_SESSIONS = 3;
export const MINIMUM_GAME_PERSONALIZATION_DAYS = 2;

export interface BktObservation {
  correct: boolean;
}

export const bktMasteryTraceSchema = z.strictObject({
  masteryProbability: z.number().min(0).max(1),
  observationCount: z.number().int().nonnegative(),
  recommendedDifficulty: z.enum(["starter", "growing", "advanced"]),
  modelVersion: z.literal("bkt-v1"),
  skillId: z.string().trim().min(1).max(100),
});

export type BktMasteryTrace = z.infer<typeof bktMasteryTraceSchema>;

function clampProbability(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function updateBktMastery(
  priorMastery: number,
  observation: BktObservation,
  parameters: BktLeveling["parameters"],
): number {
  const prior = clampProbability(priorMastery);
  const knownLikelihood = observation.correct ? 1 - parameters.slipRate : parameters.slipRate;
  const unknownLikelihood = observation.correct ? parameters.guessRate : 1 - parameters.guessRate;
  const evidenceProbability = prior * knownLikelihood + (1 - prior) * unknownLikelihood;
  const posterior =
    evidenceProbability === 0 ? prior : (prior * knownLikelihood) / evidenceProbability;

  return clampProbability(posterior + (1 - posterior) * parameters.learningRate);
}

export function traceBktMastery(
  observations: readonly BktObservation[],
  leveling: BktLeveling,
): BktMasteryTrace {
  const masteryProbability = observations.reduce(
    (mastery, observation) => updateBktMastery(mastery, observation, leveling.parameters),
    leveling.parameters.initialMastery,
  );
  const observationCount = observations.length;
  let recommendedDifficulty: GameDifficultyLevel = "starter";

  if (
    observationCount >= leveling.thresholds.advanced.minimumObservations &&
    masteryProbability >= leveling.thresholds.advanced.minimumMastery
  ) {
    recommendedDifficulty = "advanced";
  } else if (
    observationCount >= leveling.thresholds.growing.minimumObservations &&
    masteryProbability >= leveling.thresholds.growing.minimumMastery
  ) {
    recommendedDifficulty = "growing";
  }

  return bktMasteryTraceSchema.parse({
    masteryProbability,
    observationCount,
    recommendedDifficulty,
    modelVersion: leveling.modelVersion,
    skillId: leveling.skillId,
  });
}

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

export const gameVariantDecisionSchema = z.strictObject({
  preferredDifficulty: z.enum(["starter", "growing", "advanced"]).nullable(),
  reasonCode: z.enum([
    "personalization_disabled",
    "observations_disabled",
    "insufficient_game_sessions",
    "support_across_sessions",
    "independent_completion_across_sessions",
    "general_rotation",
  ]),
  explanation: z.string().trim().min(1).max(240),
  personalized: z.boolean(),
  supportingSessionCount: z.number().int().nonnegative(),
  eligibleSessionCount: z.number().int().nonnegative(),
  eligibleDayCount: z.number().int().nonnegative(),
  policyVersion: z.literal(GAME_PERSONALIZATION_POLICY_VERSION),
});
export type GameVariantDecision = z.infer<typeof gameVariantDecisionSchema>;

export interface GameVariantDecisionInput {
  personalizationEnabled: boolean;
  learningObservationsEnabled: boolean;
  eligibleSessionCount: number;
  eligibleDayCount: number;
  supportSessionCount: number;
  independentCompletionSessionCount: number;
  currentDifficulty: "starter" | "growing" | "advanced";
}

export function selectGameVariant(input: GameVariantDecisionInput): GameVariantDecision {
  const levels = ["starter", "growing", "advanced"] as const;
  const currentIndex = levels.indexOf(input.currentDifficulty);
  let preferredDifficulty: GameVariantDecision["preferredDifficulty"] = input.currentDifficulty;
  let reasonCode: GameVariantDecision["reasonCode"] = "general_rotation";
  let explanation = "Tutarlı bir çoklu oturum sinyali olmadığı için mevcut oyun sırası korunuyor.";
  let personalized = false;
  let supportingSessionCount = 0;

  if (!input.personalizationEnabled) {
    reasonCode = "personalization_disabled";
    explanation = "Kişiselleştirme kapalı olduğu için genel oyun sırası kullanılıyor.";
  } else if (!input.learningObservationsEnabled) {
    reasonCode = "observations_disabled";
    explanation = "Öğrenme gözlemleri kapalı olduğu için genel oyun sırası kullanılıyor.";
  } else if (
    input.eligibleSessionCount < MINIMUM_GAME_PERSONALIZATION_SESSIONS ||
    input.eligibleDayCount < MINIMUM_GAME_PERSONALIZATION_DAYS
  ) {
    reasonCode = "insufficient_game_sessions";
    explanation = "Oyun önerisi için en az üç oturumun iki farklı güne yayılması bekleniyor.";
  } else if (input.supportSessionCount >= MINIMUM_CONSISTENT_SIGNAL_SESSIONS) {
    preferredDifficulty = levels[Math.max(0, currentIndex - 1)] ?? "starter";
    reasonCode = "support_across_sessions";
    explanation =
      "Birden fazla oturumda destek kullanıldığı için daha sakin bir onaylı varyant öne alındı.";
    personalized = preferredDifficulty !== input.currentDifficulty;
    supportingSessionCount = input.supportSessionCount;
  } else if (input.independentCompletionSessionCount >= MINIMUM_GAME_PERSONALIZATION_SESSIONS) {
    preferredDifficulty = levels[Math.min(levels.length - 1, currentIndex + 1)] ?? "advanced";
    reasonCode = "independent_completion_across_sessions";
    explanation =
      "Birden fazla oturum yardımsız tamamlandığı için bir sonraki onaylı varyant öne alındı.";
    personalized = preferredDifficulty !== input.currentDifficulty;
    supportingSessionCount = input.independentCompletionSessionCount;
  }

  return gameVariantDecisionSchema.parse({
    preferredDifficulty,
    reasonCode,
    explanation,
    personalized,
    supportingSessionCount,
    eligibleSessionCount: input.eligibleSessionCount,
    eligibleDayCount: input.eligibleDayCount,
    policyVersion: GAME_PERSONALIZATION_POLICY_VERSION,
  });
}

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
