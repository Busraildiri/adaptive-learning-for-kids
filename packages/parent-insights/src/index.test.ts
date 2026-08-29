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
  schemaVersion: 1,
  childId,
  consentEnabled: true,
  source: "consented_session_event_projection",
  storyEvidence: [],
  gameEvidence: [],
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

  it("never emits percentages, comparisons, scores, or diagnoses", () => {
    const output = JSON.stringify(
      buildParentSessionSummary({ ...base, storyEvidence, gameEvidence }),
    );
    expect(output).not.toMatch(/%|yüzde|yaşıt|akran|puan|skor|tanı|teşhis/iu);
  });
});
