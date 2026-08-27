import { describe, expect, it } from "vitest";
import { buildParentSessionSummary } from "./index";

const childId = "11111111-1111-4111-8111-111111111111";
const session = {
  sessionId: "22222222-2222-4222-8222-222222222222",
  activityId: "story-a",
  completedAt: "2026-08-27T12:00:00.000Z",
};

describe("parent session insights", () => {
  it("fails closed when learning-observation consent is disabled", () => {
    expect(
      buildParentSessionSummary({
        childId,
        consentEnabled: false,
        completedSessionCount: 5,
        eligibleSessionCount: 5,
        distinctActivityCount: 2,
        recentSessions: [session],
      }),
    ).toMatchObject({
      status: "consent_required",
      completedSessionCount: 0,
      recentSessions: [],
      observation: null,
    });
  });

  it("provides a cold-start state when no activity is complete", () => {
    expect(
      buildParentSessionSummary({
        childId,
        consentEnabled: true,
        completedSessionCount: 0,
        eligibleSessionCount: 0,
        distinctActivityCount: 0,
        recentSessions: [],
      }).status,
    ).toBe("no_activity");
  });

  it("does not create an observation from insufficient evidence", () => {
    expect(
      buildParentSessionSummary({
        childId,
        consentEnabled: true,
        completedSessionCount: 2,
        eligibleSessionCount: 2,
        distinctActivityCount: 2,
        recentSessions: [session],
      }),
    ).toMatchObject({ status: "insufficient_data", observation: null });
  });

  it("creates only a neutral template observation after the eligibility gate", () => {
    const summary = buildParentSessionSummary({
      childId,
      consentEnabled: true,
      completedSessionCount: 3,
      eligibleSessionCount: 3,
      distinctActivityCount: 2,
      recentSessions: [session],
    });
    expect(summary).toMatchObject({
      status: "ready",
      observation: {
        code: "varied_participation",
        text: "Son oturumlarda birden fazla hikâyeye katıldı.",
      },
    });
  });

  it("never emits percentages, peer comparisons, scores, or diagnoses", () => {
    const summary = buildParentSessionSummary({
      childId,
      consentEnabled: true,
      completedSessionCount: 4,
      eligibleSessionCount: 4,
      distinctActivityCount: 2,
      recentSessions: [session],
    });
    const output = JSON.stringify(summary);
    expect(output).not.toMatch(/%|yüzde|yaşıt|akran|puan|skor|tanı|teşhis/iu);
  });
});
