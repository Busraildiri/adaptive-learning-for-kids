import { describe, expect, it } from "vitest";
import { selectPersonalizedActivity } from "./index";

const candidates = [
  {
    activityId: "story-a",
    eligibleCompletionCount: 2,
    distinctStartSessionCount: 3,
    consistentHelpSessionCount: 0,
    lastCompletedAt: "2026-08-27T12:00:00Z",
  },
  {
    activityId: "story-b",
    eligibleCompletionCount: 1,
    distinctStartSessionCount: 1,
    consistentHelpSessionCount: 0,
    lastCompletedAt: "2026-08-27T11:00:00Z",
  },
];

describe("personalization engine", () => {
  it("falls back when personalization consent is disabled", () => {
    expect(
      selectPersonalizedActivity({
        personalizationEnabled: false,
        learningObservationsEnabled: true,
        eligibleDistinctActivityCount: 5,
        candidates,
      }),
    ).toMatchObject({ personalized: false, reasonCode: "personalization_disabled" });
  });

  it("requires learning-observation consent independently", () => {
    expect(
      selectPersonalizedActivity({
        personalizationEnabled: true,
        learningObservationsEnabled: false,
        eligibleDistinctActivityCount: 5,
        candidates,
      }).reasonCode,
    ).toBe("observations_disabled");
  });

  it("does not personalize before five distinct completed activities", () => {
    expect(
      selectPersonalizedActivity({
        personalizationEnabled: true,
        learningObservationsEnabled: true,
        eligibleDistinctActivityCount: 4,
        candidates,
      }),
    ).toMatchObject({ personalized: false, reasonCode: "insufficient_distinct_activities" });
  });

  it("uses a preference only when supported by multiple sessions", () => {
    expect(
      selectPersonalizedActivity({
        personalizationEnabled: true,
        learningObservationsEnabled: true,
        eligibleDistinctActivityCount: 5,
        candidates,
      }),
    ).toMatchObject({
      selectedActivityId: "story-a",
      personalized: true,
      reasonCode: "repeated_activity_preference",
      supportingSessionCount: 3,
    });
  });

  it("prioritizes a consistent help preference supported by two sessions", () => {
    expect(
      selectPersonalizedActivity({
        personalizationEnabled: true,
        learningObservationsEnabled: true,
        eligibleDistinctActivityCount: 5,
        candidates: candidates.map((candidate) =>
          candidate.activityId === "story-b"
            ? { ...candidate, consistentHelpSessionCount: 2 }
            : candidate,
        ),
      }),
    ).toMatchObject({
      selectedActivityId: "story-b",
      reasonCode: "consistent_help_preference",
      supportingSessionCount: 2,
    });
  });

  it("never emits diagnoses, scores, percentages, or peer comparisons", () => {
    const output = JSON.stringify(
      selectPersonalizedActivity({
        personalizationEnabled: true,
        learningObservationsEnabled: true,
        eligibleDistinctActivityCount: 5,
        candidates,
      }),
    );
    expect(output).not.toMatch(/%|yüzde|yaşıt|akran|puan|skor|tanı|teşhis/iu);
  });
});
