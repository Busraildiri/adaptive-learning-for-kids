import { createInteractionEvent, type InteractionEvent } from "@adaptive/analytics-events";
import { describe, expect, it } from "vitest";
import {
  classifySessionEvidence,
  DEFAULT_EVIDENCE_THRESHOLDS,
  normalizeResponses,
  selectNextActivity,
} from "./index";

const childId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

function event(
  sequenceNumber: number,
  eventType: InteractionEvent["eventType"],
  payload: InteractionEvent["payload"] = {},
  occurredAt = `2026-08-27T09:00:0${sequenceNumber}.000Z`,
) {
  return createInteractionEvent({
    childId,
    sessionId,
    eventId: `33333333-3333-4333-8333-${sequenceNumber.toString().padStart(12, "0")}`,
    sequenceNumber,
    activityId: "story-a",
    eventType,
    payload,
    occurredAt,
  });
}

describe("evidence engine", () => {
  it("separates interaction events from derived evidence", () => {
    const events = [
      event(1, "activity_started"),
      event(2, "step_presented", { stepId: "emotion-1" }),
      event(3, "choice_selected", { stepId: "emotion-1", choiceId: "sad" }),
      event(4, "step_presented", { stepId: "help-1" }),
      event(5, "hint_requested", { stepId: "help-1", action: "hug" }),
      event(6, "activity_completed"),
    ];

    expect(classifySessionEvidence(events)).toMatchObject({
      classification: "valid_evidence",
      reasonCode: "completed_with_multiple_responses",
    });
  });

  it("classifies a single fast answer as limited evidence, not noise", () => {
    const evidence = classifySessionEvidence([
      event(1, "step_presented", { stepId: "emotion-1" }, "2026-08-27T09:00:00.000Z"),
      event(
        2,
        "choice_selected",
        { stepId: "emotion-1", choiceId: "sad" },
        "2026-08-27T09:00:00.120Z",
      ),
      event(3, "activity_completed"),
    ]);

    expect(evidence.classification).toBe("limited_evidence");
    expect(evidence.reasonCode).toBe("single_fast_response");
  });

  it("removes repeat taps from response analysis", () => {
    const normalized = normalizeResponses([
      event(1, "step_presented", { stepId: "emotion-1" }),
      event(2, "choice_selected", { stepId: "emotion-1", choiceId: "sad" }),
      event(3, "choice_selected", { stepId: "emotion-1", choiceId: "angry" }),
    ]);

    expect(normalized.responses.map((response) => response.choiceId)).toEqual(["sad"]);
    expect(normalized.duplicateResponseCount).toBe(1);
  });

  it("keeps incomplete ordinary sessions unevaluated", () => {
    expect(classifySessionEvidence([event(1, "activity_started")]).classification).toBe(
      "not_evaluated",
    );
  });

  it("classifies duplicate-dominated incomplete interaction as noise", () => {
    const evidence = classifySessionEvidence([
      event(1, "step_presented", { stepId: "emotion-1" }),
      event(2, "choice_selected", { stepId: "emotion-1", choiceId: "sad" }),
      event(3, "choice_selected", { stepId: "emotion-1", choiceId: "angry" }),
      event(4, "choice_selected", { stepId: "emotion-1", choiceId: "happy" }),
    ]);
    expect(evidence).toMatchObject({
      classification: "interaction_noise",
      reasonCode: "duplicate_dominated_interaction",
    });
  });

  it("uses configurable thresholds", () => {
    const evidence = classifySessionEvidence(
      [
        event(1, "step_presented", { stepId: "emotion-1" }),
        event(2, "choice_selected", { stepId: "emotion-1", choiceId: "sad" }),
        event(3, "activity_completed"),
      ],
      { ...DEFAULT_EVIDENCE_THRESHOLDS, version: "pilot-v2", minimumDistinctResponses: 1 },
    );
    expect(evidence).toMatchObject({
      classification: "valid_evidence",
      thresholdVersion: "pilot-v2",
    });
  });

  it("selects unseen then least-practiced activities with an explanation", () => {
    const unseen = selectNextActivity([
      { activityId: "story-a", completionCount: 2, lastCompletedAt: "2026-08-27T10:00:00Z" },
      { activityId: "story-b", completionCount: 0, lastCompletedAt: null },
    ]);
    expect(unseen).toMatchObject({ selectedActivityId: "story-b", reasonCode: "unseen_activity" });

    const practiced = selectNextActivity([
      { activityId: "story-a", completionCount: 3, lastCompletedAt: "2026-08-27T10:00:00Z" },
      { activityId: "story-b", completionCount: 1, lastCompletedAt: "2026-08-27T11:00:00Z" },
    ]);
    expect(practiced).toMatchObject({
      selectedActivityId: "story-b",
      reasonCode: "least_practiced",
    });
    expect(practiced.explanation.length).toBeGreaterThan(0);
  });
});
