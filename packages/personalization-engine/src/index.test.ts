import type { BktLeveling } from "@adaptive/content-schema";
import { describe, expect, it } from "vitest";
import {
  selectGameVariant,
  selectPersonalizedActivity,
  traceBktMastery,
  updateBktMastery,
} from "./index";

const routineBkt: BktLeveling = {
  strategy: "bkt",
  modelVersion: "bkt-v1",
  skillId: "routine-ordering",
  parameters: {
    initialMastery: 0.25,
    learningRate: 0.15,
    guessRate: 0.2,
    slipRate: 0.1,
  },
  thresholds: {
    growing: { minimumMastery: 0.55, minimumObservations: 4 },
    advanced: { minimumMastery: 0.8, minimumObservations: 8 },
  },
};

describe("Bayesian Knowledge Tracing", () => {
  it("raises estimated mastery after a correct observation", () => {
    expect(updateBktMastery(0.25, { correct: true }, routineBkt.parameters)).toBeGreaterThan(0.25);
  });

  it("never changes level from a single answer", () => {
    expect(traceBktMastery([{ correct: true }], routineBkt)).toMatchObject({
      observationCount: 1,
      recommendedDifficulty: "starter",
    });
  });

  it("selects the 5, 8 and 12-round level bands only after enough evidence", () => {
    const correct = (count: number) => Array.from({ length: count }, () => ({ correct: true }));

    expect(traceBktMastery([], routineBkt).recommendedDifficulty).toBe("starter");
    expect(traceBktMastery(correct(4), routineBkt).recommendedDifficulty).toBe("growing");
    expect(traceBktMastery(correct(8), routineBkt).recommendedDifficulty).toBe("advanced");
  });

  it("keeps repeated supported attempts in the starter level", () => {
    const observations = Array.from({ length: 8 }, () => ({ correct: false }));
    expect(traceBktMastery(observations, routineBkt).recommendedDifficulty).toBe("starter");
  });
});

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

describe("game variant personalization", () => {
  const base = {
    personalizationEnabled: true,
    learningObservationsEnabled: true,
    eligibleSessionCount: 3,
    eligibleDayCount: 2,
    supportSessionCount: 0,
    independentCompletionSessionCount: 0,
    currentDifficulty: "growing" as const,
  };

  it("does not adapt from one session or one error", () => {
    expect(
      selectGameVariant({
        ...base,
        eligibleSessionCount: 1,
        eligibleDayCount: 1,
        supportSessionCount: 1,
      }),
    ).toMatchObject({ personalized: false, reasonCode: "insufficient_game_sessions" });
  });

  it("selects an easier approved level after support across sessions", () => {
    expect(selectGameVariant({ ...base, supportSessionCount: 2 })).toMatchObject({
      preferredDifficulty: "starter",
      personalized: true,
      reasonCode: "support_across_sessions",
    });
  });

  it("selects a harder approved level after three independent completions", () => {
    expect(selectGameVariant({ ...base, independentCompletionSessionCount: 3 })).toMatchObject({
      preferredDifficulty: "advanced",
      personalized: true,
      reasonCode: "independent_completion_across_sessions",
    });
  });
});
