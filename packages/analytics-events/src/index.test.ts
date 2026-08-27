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
});
