import { z } from "zod";

export const PARENT_INSIGHT_SCHEMA_VERSION = 3 as const;
export const PARENT_INSIGHT_POLICY_VERSION = "parent-insight-policy-v3" as const;
export const PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION = "parent-insight-retrieval-v1" as const;
export const MINIMUM_ELIGIBLE_SESSIONS = 3;
export const MINIMUM_GAME_INSIGHT_SESSIONS = 3;
export const MINIMUM_GAME_INSIGHT_DAYS = 1;
export const MINIMUM_REPEATED_SIGNAL_SESSIONS = 2;
export const LONG_WAIT_THRESHOLD_MS = 7_000;

export const gameEvidenceSignalSchema = z.enum([
  "completed",
  "help_shown",
  "retried",
  "waited_longer",
  "left_early",
]);

export const retrievedStoryEvidenceSchema = z.strictObject({
  sessionId: z.uuid(),
  activityId: z.string().trim().min(1).max(100),
  completedAt: z.iso.datetime({ offset: true }),
  classification: z.enum(["valid_evidence", "limited_evidence"]),
});

export const retrievedGameEvidenceSchema = z.strictObject({
  sessionId: z.uuid(),
  gameId: z.string().trim().min(1).max(100),
  outcome: z.enum(["completed", "left_early", "in_progress"]),
  occurredAt: z.iso.datetime({ offset: true }),
  signals: z.array(gameEvidenceSignalSchema).min(1).max(5),
});

export const parentInsightEvidenceBundleSchema = z.strictObject({
  schemaVersion: z.literal(1),
  childId: z.uuid(),
  consentEnabled: z.boolean(),
  source: z.literal("consented_session_event_projection"),
  storyEvidence: z.array(retrievedStoryEvidenceSchema).max(50),
  gameEvidence: z.array(retrievedGameEvidenceSchema).max(50),
  retrievedAt: z.iso.datetime({ offset: true }),
  retrievalPolicyVersion: z.literal(PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION),
});

export const recentSessionSchema = retrievedStoryEvidenceSchema.omit({ classification: true });

export const qualitativeObservationSchema = z.strictObject({
  code: z.enum(["continued_participation", "varied_participation"]),
  text: z.string().trim().min(1).max(240),
  supportingSessionIds: z.array(z.uuid()).min(MINIMUM_ELIGIBLE_SESSIONS).max(12),
});

export const recentGameSessionSchema = retrievedGameEvidenceSchema.omit({ signals: true });

export const gameInsightSchema = z.strictObject({
  code: z.enum([
    "continued_play",
    "support_was_useful",
    "tried_again",
    "took_more_time",
    "paused_and_left",
  ]),
  title: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(240),
  supportingSessionCount: z.number().int().min(MINIMUM_REPEATED_SIGNAL_SESSIONS),
  supportingSessionIds: z.array(z.uuid()).min(MINIMUM_REPEATED_SIGNAL_SESSIONS).max(12),
});

export const retrievalSummarySchema = z.strictObject({
  source: z.literal("consented_session_event_projection"),
  storyEvidenceCount: z.number().int().nonnegative(),
  gameEvidenceCount: z.number().int().nonnegative(),
  gameDayCount: z.number().int().nonnegative(),
  windowStartedAt: z.iso.datetime({ offset: true }).nullable(),
  windowEndedAt: z.iso.datetime({ offset: true }).nullable(),
  retrievedAt: z.iso.datetime({ offset: true }),
  retrievalPolicyVersion: z.literal(PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION),
});

export const parentSessionSummarySchema = z.strictObject({
  schemaVersion: z.literal(PARENT_INSIGHT_SCHEMA_VERSION),
  status: z.enum(["consent_required", "no_activity", "insufficient_data", "ready"]),
  childId: z.uuid(),
  completedSessionCount: z.number().int().nonnegative(),
  eligibleSessionCount: z.number().int().nonnegative(),
  recentSessions: z.array(recentSessionSchema).max(5),
  observation: qualitativeObservationSchema.nullable(),
  gameStatus: z.enum(["consent_required", "no_activity", "insufficient_data", "ready"]),
  eligibleGameSessionCount: z.number().int().nonnegative(),
  eligibleGameDayCount: z.number().int().nonnegative(),
  recentGameSessions: z.array(recentGameSessionSchema).max(5),
  gameInsights: z.array(gameInsightSchema).max(5),
  retrieval: retrievalSummarySchema,
  generatedAt: z.iso.datetime({ offset: true }),
  policyVersion: z.literal(PARENT_INSIGHT_POLICY_VERSION),
});

export type ParentInsightEvidenceBundle = z.infer<typeof parentInsightEvidenceBundleSchema>;
export type ParentSessionSummary = z.infer<typeof parentSessionSummarySchema>;

function uniqueDays(evidence: ParentInsightEvidenceBundle["gameEvidence"]): number {
  return new Set(evidence.map((item) => item.occurredAt.slice(0, 10))).size;
}

function evidenceWindow(
  evidence: ParentInsightEvidenceBundle,
): Pick<z.infer<typeof retrievalSummarySchema>, "windowStartedAt" | "windowEndedAt"> {
  const timestamps = [
    ...evidence.storyEvidence.map((item) => item.completedAt),
    ...evidence.gameEvidence.map((item) => item.occurredAt),
  ].sort();
  return {
    windowStartedAt: timestamps[0] ?? null,
    windowEndedAt: timestamps.at(-1) ?? null,
  };
}

export function buildParentSessionSummary(
  rawEvidence: ParentInsightEvidenceBundle,
): ParentSessionSummary {
  const evidence = parentInsightEvidenceBundleSchema.parse(rawEvidence);
  const storyEvidence = evidence.consentEnabled ? evidence.storyEvidence : [];
  const gameEvidence = evidence.consentEnabled ? evidence.gameEvidence : [];
  const distinctActivityCount = new Set(storyEvidence.map((item) => item.activityId)).size;
  const gameDayCount = uniqueDays(gameEvidence);

  const status: ParentSessionSummary["status"] = !evidence.consentEnabled
    ? "consent_required"
    : storyEvidence.length === 0
      ? "no_activity"
      : storyEvidence.length < MINIMUM_ELIGIBLE_SESSIONS
        ? "insufficient_data"
        : "ready";

  const observationEvidence = storyEvidence.slice(0, 12);
  const observation: ParentSessionSummary["observation"] =
    status !== "ready"
      ? null
      : distinctActivityCount >= 2
        ? {
            code: "varied_participation",
            text: "Son oturumlarda birden fazla hikâyeye katıldı.",
            supportingSessionIds: observationEvidence.map((item) => item.sessionId),
          }
        : {
            code: "continued_participation",
            text: "Son oturumlarda hikâyeyi tamamlamaya devam etti.",
            supportingSessionIds: observationEvidence.map((item) => item.sessionId),
          };

  const gameStatus: ParentSessionSummary["gameStatus"] = !evidence.consentEnabled
    ? "consent_required"
    : gameEvidence.length === 0
      ? "no_activity"
      : gameEvidence.length < MINIMUM_GAME_INSIGHT_SESSIONS ||
          gameDayCount < MINIMUM_GAME_INSIGHT_DAYS
        ? "insufficient_data"
        : "ready";

  const gameInsights: ParentSessionSummary["gameInsights"] = [];
  const addInsight = (
    signal: z.infer<typeof gameEvidenceSignalSchema>,
    insight: Omit<
      ParentSessionSummary["gameInsights"][number],
      "supportingSessionCount" | "supportingSessionIds"
    >,
  ) => {
    if (gameStatus !== "ready") return;
    const supportingEvidence = gameEvidence.filter((item) => item.signals.includes(signal));
    if (supportingEvidence.length < MINIMUM_REPEATED_SIGNAL_SESSIONS) return;
    gameInsights.push({
      ...insight,
      supportingSessionCount: supportingEvidence.length,
      supportingSessionIds: supportingEvidence.slice(0, 12).map((item) => item.sessionId),
    });
  };

  addInsight("completed", {
    code: "continued_play",
    title: "Oyuna devam etti",
    text: "Birden fazla oyun oturumunu tamamladı.",
  });
  addInsight("help_shown", {
    code: "support_was_useful",
    title: "Destekten yararlandı",
    text: "Birden fazla oturumda oyun içi destek gösterildi.",
  });
  addInsight("retried", {
    code: "tried_again",
    title: "Yeniden denedi",
    text: "Birden fazla oturumda oyunu yeniden denemeyi sürdürdü.",
  });
  addInsight("waited_longer", {
    code: "took_more_time",
    title: "Daha fazla zaman kullandı",
    text: "Birden fazla oturumda yönergeden sonra ek süre kullandı.",
  });
  addInsight("left_early", {
    code: "paused_and_left",
    title: "Oyuna ara verdi",
    text: "Birden fazla oturumda oyunu tamamlamadan kapattı; bu tek başına bir güçlük göstergesi değildir.",
  });

  return parentSessionSummarySchema.parse({
    schemaVersion: PARENT_INSIGHT_SCHEMA_VERSION,
    status,
    childId: evidence.childId,
    completedSessionCount: storyEvidence.length,
    eligibleSessionCount: storyEvidence.length,
    recentSessions: storyEvidence
      .slice(0, 5)
      .map(({ classification: _classification, ...item }) => item),
    observation,
    gameStatus,
    eligibleGameSessionCount: gameEvidence.length,
    eligibleGameDayCount: gameDayCount,
    recentGameSessions: gameEvidence.slice(0, 5).map(({ signals: _signals, ...item }) => item),
    gameInsights,
    retrieval: {
      source: evidence.source,
      storyEvidenceCount: storyEvidence.length,
      gameEvidenceCount: gameEvidence.length,
      gameDayCount,
      ...evidenceWindow({ ...evidence, storyEvidence, gameEvidence }),
      retrievedAt: evidence.retrievedAt,
      retrievalPolicyVersion: evidence.retrievalPolicyVersion,
    },
    generatedAt: evidence.retrievedAt,
    policyVersion: PARENT_INSIGHT_POLICY_VERSION,
  });
}
