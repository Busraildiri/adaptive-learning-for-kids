import { describe, expect, it } from "vitest";
import { createInteractionEvent, interactionEventBatchSchema } from "./index";

const identifiers = {
  childId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
};

function event(sequenceNumber: number) {
  return createInteractionEvent({
    ...identifiers,
    eventId: `33333333-3333-4333-8333-${sequenceNumber.toString().padStart(12, "0")}`,
    sequenceNumber,
    activityId: "mino-story-v1",
    eventType: "step_presented",
    occurredAt: "2026-08-27T09:00:00.000Z",
    payload: { stepId: `step${sequenceNumber}` },
  });
}

describe("interaction event contract", () => {
  it("creates a strict versioned event", () => {
    expect(event(1)).toMatchObject({ schemaVersion: 1, sequenceNumber: 1 });
  });

  it("rejects oversized payloads", () => {
    expect(() => event(1)).not.toThrow();
    expect(() =>
      createInteractionEvent({
        ...identifiers,
        eventId: "33333333-3333-4333-8333-333333333333",
        sequenceNumber: 1,
        activityId: "mino-story-v1",
        eventType: "choice_selected",
        payload: { value: "x".repeat(101) },
      }),
    ).toThrow();
  });

  it("requires batches to preserve sequence order", () => {
    expect(() => interactionEventBatchSchema.parse([event(2), event(1)])).toThrow();
    expect(interactionEventBatchSchema.parse([event(1), event(2)])).toHaveLength(2);
  });

  it("accepts only minimal game support signals", () => {
    const retry = createInteractionEvent({
      ...identifiers,
      eventId: "44444444-4444-4444-8444-444444444444",
      sequenceNumber: 2,
      activityId: "fish-patterns-001",
      eventType: "retry_requested",
      payload: { stepId: "round2" },
    });
    const wait = createInteractionEvent({
      ...identifiers,
      eventId: "55555555-5555-4555-8555-555555555555",
      sequenceNumber: 3,
      activityId: "fish-patterns-001",
      eventType: "inactivity_help_shown",
      payload: { stepId: "round2", waitMs: 7000 },
    });

    expect([retry.eventType, wait.eventType]).toEqual(["retry_requested", "inactivity_help_shown"]);
    expect(JSON.stringify([retry, wait])).not.toMatch(/answer|correct|score|diagnosis/iu);
  });
});
