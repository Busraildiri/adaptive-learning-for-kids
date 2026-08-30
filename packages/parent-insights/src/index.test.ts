import { describe, expect, it } from "vitest";
import {
  buildParentSessionSummary,
  PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION,
  type ParentInsightEvidenceBundle,
} from "./index";

const childId = "11111111-1111-4111-8111-111111111111";
const storyEvidence: ParentInsightEvidenceBundle["storyEvidence"] = [
  {
    sessionId: "22222222-2222-4222-8222-222222222221",
    activityId: "story-a",
    completedAt: "2026-08-27T12:00:00.000Z",
    classification: "valid_evidence",
  },
  {
    sessionId: "22222222-2222-4222-8222-222222222222",
    activityId: "story-b",
    completedAt: "2026-08-27T13:00:00.000Z",
    classification: "valid_evidence",
  },
  {
    sessionId: "22222222-2222-4222-8222-222222222223",
    activityId: "story-a",
    completedAt: "2026-08-28T12:00:00.000Z",
    classification: "limited_evidence",
  },
];
const gameEvidence: ParentInsightEvidenceBundle["gameEvidence"] = [
  {
    sessionId: "66666666-6666-4666-8666-666666666661",
    gameId: "fish-patterns-001",
    outcome: "completed",
    occurredAt: "2026-08-27T12:30:00.000Z",
    signals: ["completed", "retried"],
  },
  {
    sessionId: "66666666-6666-4666-8666-666666666662",
    gameId: "fish-patterns-001",
    outcome: "completed",
    occurredAt: "2026-08-28T12:30:00.000Z",
    signals: ["completed", "retried", "help_shown"],
  },
  {
    sessionId: "66666666-6666-4666-8666-666666666663",
    gameId: "fish-patterns-001",
    outcome: "left_early",
    occurredAt: "2026-08-28T13:30:00.000Z",
    signals: ["left_early", "help_shown"],
  },
];
const base: ParentInsightEvidenceBundle = {
  schemaVersion: 2,
  childId,
  consentEnabled: true,
  source: "consented_session_event_projection",
  storyEvidence: [],
  gameEvidence: [],
  profileContext: {
    nickname: "Ece",
    ageBand: "4-7",
    personalizationEnabled: true,
    favoriteAnimals: ["tavşan"],
    favoriteToys: ["bloklar"],
    interests: ["uzay"],
    profileUpdatedAt: "2026-08-28T13:00:00.000Z",
  },
  retrievedAt: "2026-08-28T14:00:00.000Z",
  retrievalPolicyVersion: PARENT_INSIGHT_RETRIEVAL_POLICY_VERSION,
};

describe("RAG-grounded parent session insights", () => {
  it("fails closed and discards retrieved rows when consent is disabled", () => {
    expect(
      buildParentSessionSummary({
        ...base,
        consentEnabled: false,
        storyEvidence,
        gameEvidence,
      }),
    ).toMatchObject({
      status: "consent_required",
      completedSessionCount: 0,
      recentSessions: [],
      observation: null,
      gameStatus: "consent_required",
      gameInsights: [],
      activityDetails: {
        totalSessionCount: 0,
        activeDayCount: 0,
        distinctStoryCount: 0,
        distinctGameCount: 0,
      },
      retrieval: { storyEvidenceCount: 0, gameEvidenceCount: 0 },
    });
  });

  it("does not generate a claim from insufficient retrieved evidence", () => {
    const summary = buildParentSessionSummary({
      ...base,
      storyEvidence: storyEvidence.slice(0, 2),
    });
    expect(summary).toMatchObject({ status: "insufficient_data", observation: null });
  });

  it("grounds a story observation in the retrieved session ids", () => {
    const summary = buildParentSessionSummary({ ...base, storyEvidence });
    expect(summary).toMatchObject({
      status: "ready",
      observation: {
        code: "varied_participation",
        supportingSessionIds: storyEvidence.map((item) => item.sessionId),
      },
    });
  });

  it("generates game insights from three sessions completed on the same day", () => {
    const sameDay = buildParentSessionSummary({
      ...base,
      gameEvidence: gameEvidence.map((item) => ({
        ...item,
        occurredAt: "2026-08-28T12:30:00.000Z",
      })),
    });
    expect(sameDay.gameStatus).toBe("ready");
    expect(sameDay.eligibleGameDayCount).toBe(1);
  });

  it("cites only sessions containing the signal used by each card", () => {
    const summary = buildParentSessionSummary({ ...base, gameEvidence });
    const retryInsight = summary.gameInsights.find((insight) => insight.code === "tried_again");
    const helpInsight = summary.gameInsights.find(
      (insight) => insight.code === "support_was_useful",
    );

    expect(retryInsight?.supportingSessionIds).toEqual([
      gameEvidence[0]?.sessionId,
      gameEvidence[1]?.sessionId,
    ]);
    expect(helpInsight?.supportingSessionIds).toEqual([
      gameEvidence[1]?.sessionId,
      gameEvidence[2]?.sessionId,
    ]);
  });

  it("recognizes partial progress and returning to the same game", () => {
    const evidence = gameEvidence.map((item, index) => ({
      ...item,
      outcome: "left_early" as const,
      signals:
        index < 2
          ? (["left_early", "progressed", "replayed"] as const)
          : (["left_early", "replayed"] as const),
    }));
    const summary = buildParentSessionSummary({ ...base, gameEvidence: evidence });

    expect(summary.gameInsights.map((insight) => insight.code)).toContain(
      "progressed_without_finishing",
    );
    expect(summary.gameInsights.map((insight) => insight.code)).toContain("returned_to_game");
    expect(summary.ongoingGames).toEqual([
      expect.objectContaining({
        gameId: "fish-patterns-001",
        outcome: "left_early",
        sessionCount: 3,
      }),
    ]);
  });

  it("separates moving on after completion from leaving at higher difficulty", () => {
    const evidence: ParentInsightEvidenceBundle["gameEvidence"] = gameEvidence.map(
      (item, index) => ({
        ...item,
        outcome: index === 2 ? "in_progress" : "left_early",
        adaptiveLevel: 58 + index,
        difficulty: "growing",
        signals:
          index < 2
            ? ["left_early", "completed_without_replay", "left_at_higher_difficulty"]
            : ["left_early", "left_at_higher_difficulty"],
      }),
    );
    const summary = buildParentSessionSummary({ ...base, gameEvidence: evidence });

    expect(summary.gameInsights.map((insight) => insight.code)).toContain("completed_and_moved_on");
    expect(summary.gameInsights.map((insight) => insight.code)).toContain(
      "difficulty_related_dropout",
    );
    expect(summary.ongoingGames[0]).toMatchObject({
      gameId: "fish-patterns-001",
      adaptiveLevel: 60,
      difficulty: "growing",
      sessionCount: 3,
    });
  });

  it("builds detailed activity counts from the complete evidence window", () => {
    const summary = buildParentSessionSummary({ ...base, storyEvidence, gameEvidence });

    expect(summary.activityDetails).toEqual({
      totalSessionCount: 6,
      activeDayCount: 2,
      distinctStoryCount: 2,
      distinctGameCount: 1,
      completedGameSessionCount: 2,
      pausedGameSessionCount: 1,
      inProgressGameSessionCount: 0,
      mostRepeatedStory: { activityId: "story-a", sessionCount: 2 },
      mostRepeatedGame: { activityId: "fish-patterns-001", sessionCount: 3 },
    });
  });

  it("personalizes parent guidance with only the retrieved child profile context", () => {
    const summary = buildParentSessionSummary({ ...base, storyEvidence, gameEvidence });

    expect(summary.parentGuidance).toMatchObject({
      personalized: true,
      grounding: "profile_and_session_evidence",
      contextLabels: ["uzay", "tavşan", "bloklar"],
    });
    expect(summary.parentGuidance.ideas.join(" ")).toContain("uzay");
    expect(summary.profileContext.nickname).toBe("Ece");
  });

  it("does not leak profile preferences when personalization context is disabled", () => {
    const summary = buildParentSessionSummary({
      ...base,
      storyEvidence,
      profileContext: {
        ...base.profileContext,
        personalizationEnabled: false,
        favoriteAnimals: [],
        favoriteToys: [],
        interests: [],
      },
    });

    expect(summary.parentGuidance.personalized).toBe(false);
    expect(summary.parentGuidance.contextLabels).toEqual([]);
    expect(JSON.stringify(summary.parentGuidance)).not.toContain("uzay");
  });

  it("never emits percentages, comparisons, scores, or diagnoses", () => {
    const output = JSON.stringify(
      buildParentSessionSummary({ ...base, storyEvidence, gameEvidence }),
    );
    expect(output).not.toMatch(/%|yüzde|yaşıt|akran|puan|skor|tanı|teşhis/iu);
  });
});
