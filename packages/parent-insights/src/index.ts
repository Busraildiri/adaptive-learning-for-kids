import { z } from "zod";

export const PARENT_INSIGHT_SCHEMA_VERSION = 5 as const;
export const PARENT_INSIGHT_POLICY_VERSION = "parent-insight-policy-v5" as const;
export const PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION = "parent-insight-retrieval-v2" as const;
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

const profilePreferenceSchema = z.string().trim().min(1).max(100);

export const parentInsightProfileContextSchema = z.strictObject({
  nickname: z.string().trim().min(1).max(40),
  ageBand: z.enum(["2-4", "4-7", "outside_supported_range"]),
  personalizationEnabled: z.boolean(),
  favoriteAnimals: z.array(profilePreferenceSchema).max(10),
  favoriteToys: z.array(profilePreferenceSchema).max(10),
  interests: z.array(profilePreferenceSchema).max(10),
  profileUpdatedAt: z.iso.datetime({ offset: true }),
});

export const parentInsightEvidenceBundleSchema = z.strictObject({
  schemaVersion: z.literal(2),
  childId: z.uuid(),
  consentEnabled: z.boolean(),
  source: z.literal("consented_session_event_projection"),
  storyEvidence: z.array(retrievedStoryEvidenceSchema).max(50),
  gameEvidence: z.array(retrievedGameEvidenceSchema).max(50),
  profileContext: parentInsightProfileContextSchema,
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

const repeatedActivitySchema = z.strictObject({
  activityId: z.string().trim().min(1).max(100),
  sessionCount: z.number().int().positive(),
});

export const activityDetailSummarySchema = z.strictObject({
  totalSessionCount: z.number().int().nonnegative(),
  activeDayCount: z.number().int().nonnegative(),
  distinctStoryCount: z.number().int().nonnegative(),
  distinctGameCount: z.number().int().nonnegative(),
  completedGameSessionCount: z.number().int().nonnegative(),
  pausedGameSessionCount: z.number().int().nonnegative(),
  inProgressGameSessionCount: z.number().int().nonnegative(),
  mostRepeatedStory: repeatedActivitySchema.nullable(),
  mostRepeatedGame: repeatedActivitySchema.nullable(),
});

export const parentGuidanceSchema = z.strictObject({
  personalized: z.boolean(),
  grounding: z.enum(["profile_and_session_evidence", "session_evidence_only", "general"]),
  contextLabels: z.array(profilePreferenceSchema).max(6),
  ideas: z.array(z.string().trim().min(1).max(280)).min(1).max(3),
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
  activityDetails: activityDetailSummarySchema,
  profileContext: parentInsightProfileContextSchema,
  parentGuidance: parentGuidanceSchema,
  retrieval: retrievalSummarySchema,
  generatedAt: z.iso.datetime({ offset: true }),
  policyVersion: z.literal(PARENT_INSIGHT_POLICY_VERSION),
});

export type ParentInsightEvidenceBundle = z.infer<typeof parentInsightEvidenceBundleSchema>;
export type ParentSessionSummary = z.infer<typeof parentSessionSummarySchema>;

function uniqueDays(evidence: ParentInsightEvidenceBundle["gameEvidence"]): number {
  return new Set(evidence.map((item) => item.occurredAt.slice(0, 10))).size;
}

function countActiveDays(evidence: ParentInsightEvidenceBundle): number {
  return new Set([
    ...evidence.storyEvidence.map((item) => item.completedAt.slice(0, 10)),
    ...evidence.gameEvidence.map((item) => item.occurredAt.slice(0, 10)),
  ]).size;
}

function mostRepeatedActivity<T>(
  items: T[],
  getId: (item: T) => string,
): z.infer<typeof repeatedActivitySchema> | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    const activityId = getId(item);
    counts.set(activityId, (counts.get(activityId) ?? 0) + 1);
  }
  const mostRepeated = [...counts.entries()].sort(
    ([leftId, leftCount], [rightId, rightCount]) =>
      rightCount - leftCount || leftId.localeCompare(rightId),
  )[0];
  return mostRepeated ? { activityId: mostRepeated[0], sessionCount: mostRepeated[1] } : null;
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

const parentIdeaByGameInsight: Record<
  ParentSessionSummary["gameInsights"][number]["code"],
  string
> = {
  continued_play: "Tamamladığı bir oyunu birlikte seçip en sevdiği bölümünü anlatmasını isteyin.",
  support_was_useful:
    "Yeni bir etkinlikte önce birlikte bir örnek yapın, sonra seçimi ona bırakın.",
  tried_again:
    "Zorlandığı bir şeyde sonucu değil yeniden deneme davranışını fark ettiğinizi söyleyin.",
  took_more_time: "Bir soru sorduktan sonra yanıt vermesi için sessizce biraz daha bekleyin.",
  paused_and_left:
    "Kısa bir oyun seçeneği sunun; ara vermek isterse daha sonra devam edebileceğini hatırlatın.",
};

function ageAwareIdea(
  ageBand: ParentInsightEvidenceBundle["profileContext"]["ageBand"],
  youngerIdea: string,
  olderIdea: string,
  fallbackIdea: string,
): string {
  if (ageBand === "2-4") return youngerIdea;
  if (ageBand === "4-7") return olderIdea;
  return fallbackIdea;
}

function buildParentGuidance(
  evidence: ParentInsightEvidenceBundle,
  observation: ParentSessionSummary["observation"],
  gameInsights: ParentSessionSummary["gameInsights"],
): z.infer<typeof parentGuidanceSchema> {
  const profile = evidence.profileContext;
  const contextLabels = [
    ...profile.interests,
    ...profile.favoriteAnimals,
    ...profile.favoriteToys,
  ].filter((value, index, values) => values.indexOf(value) === index);
  const ideas: string[] = [];

  if (profile.personalizationEnabled) {
    const interest = profile.interests[0];
    const animal = profile.favoriteAnimals[0];
    const toy = profile.favoriteToys[0];
    if (interest) {
      ideas.push(
        ageAwareIdea(
          profile.ageBand,
          `${interest} temasındaki resimleri birlikte bulup adlandırın.`,
          `${interest} hakkında başlangıcı, ortası ve sonu olan kısa bir hikâye kurun.`,
          `${interest} hakkında birlikte kısa bir sohbet başlatın.`,
        ),
      );
    }
    if (animal) {
      ideas.push(
        ageAwareIdea(
          profile.ageBand,
          `${animal} resimleriyle renkleri veya sayıları birlikte söyleyin.`,
          `${animal} kahramanlı küçük bir problem kurup çözüm yollarını birlikte düşünün.`,
          `${animal} hakkında bildiklerinizi sırayla paylaşın.`,
        ),
      );
    }
    if (toy) {
      ideas.push(
        ageAwareIdea(
          profile.ageBand,
          `${toy} ile sırayla dokunma, bulma veya eşleştirme oyunu oynayın.`,
          `${toy} ile üç adımlı bir görev tasarlamasını isteyin.`,
          `${toy} ile birlikte kısa bir etkinlik tasarlayın.`,
        ),
      );
    }
    if (ideas.length === 0) {
      ideas.push(
        ageAwareIdea(
          profile.ageBand,
          "Günlük bir nesneyi seçip adını, rengini ve yerini birlikte söyleyin.",
          "Bugünkü bir etkinliği üç adımlı kısa bir hikâyeye dönüştürün.",
          "Bugünkü bir etkinlik hakkında birlikte kısa bir sohbet edin.",
        ),
      );
    }
  }

  if (observation?.code === "varied_participation") {
    ideas.push("İki hikâye kapağı gösterip hangisini neden seçtiğini sorun.");
  } else if (observation?.code === "continued_participation") {
    ideas.push("Bir hikâyenin sonunda en sevdiği sahneyi birlikte yeniden canlandırın.");
  }

  for (const insight of gameInsights) ideas.push(parentIdeaByGameInsight[insight.code]);

  if (ideas.length === 0) {
    ideas.push(
      "Bir oyun veya hikâye seçimini çocuğunuza bırakın; sonunda en sevdiği kısmı sorun.",
      "Kısa bir etkinliği birlikte tamamlayıp çabasını fark ettiğinizi söyleyin.",
    );
  }

  return parentGuidanceSchema.parse({
    personalized: profile.personalizationEnabled,
    grounding: profile.personalizationEnabled
      ? "profile_and_session_evidence"
      : evidence.storyEvidence.length + evidence.gameEvidence.length > 0
        ? "session_evidence_only"
        : "general",
    contextLabels: profile.personalizationEnabled ? contextLabels.slice(0, 6) : [],
    ideas: [...new Set(ideas)].slice(0, 3),
  });
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
    activityDetails: {
      totalSessionCount: storyEvidence.length + gameEvidence.length,
      activeDayCount: countActiveDays({ ...evidence, storyEvidence, gameEvidence }),
      distinctStoryCount: distinctActivityCount,
      distinctGameCount: new Set(gameEvidence.map((item) => item.gameId)).size,
      completedGameSessionCount: gameEvidence.filter((item) => item.outcome === "completed").length,
      pausedGameSessionCount: gameEvidence.filter((item) => item.outcome === "left_early").length,
      inProgressGameSessionCount: gameEvidence.filter((item) => item.outcome === "in_progress")
        .length,
      mostRepeatedStory: mostRepeatedActivity(storyEvidence, (item) => item.activityId),
      mostRepeatedGame: mostRepeatedActivity(gameEvidence, (item) => item.gameId),
    },
    profileContext: evidence.profileContext,
    parentGuidance: buildParentGuidance(evidence, observation, gameInsights),
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
