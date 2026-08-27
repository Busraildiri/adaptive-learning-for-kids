import { createInteractionEvent, type InteractionEvent } from "@adaptive/analytics-events";
import { describe, expect, it, vi } from "vitest";
import {
  type InteractionEventStore,
  InteractionEventSynchronizer,
  type InteractionEventTransport,
} from "./interactionEventQueue";

vi.mock("expo-sqlite", () => ({ openDatabaseAsync: vi.fn() }));

class MemoryEventStore implements InteractionEventStore {
  events: InteractionEvent[] = [];

  async initialize() {}

  async enqueue(event: InteractionEvent) {
    if (!this.events.some((queued) => queued.eventId === event.eventId)) {
      this.events.push(event);
    }
  }

  async readOldestSessionBatch(limit: number) {
    const sessionId = this.events[0]?.sessionId;
    return this.events
      .filter((event) => event.sessionId === sessionId)
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
      .slice(0, limit);
  }

  async remove(eventIds: string[]) {
    this.events = this.events.filter((event) => !eventIds.includes(event.eventId));
  }

  async clearForChild(childId: string) {
    this.events = this.events.filter((event) => event.childId !== childId);
  }

  async count() {
    return this.events.length;
  }
}

const childId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

function queuedEvent(sequenceNumber: number): InteractionEvent {
  return createInteractionEvent({
    childId,
    sessionId,
    eventId: `33333333-3333-4333-8333-${sequenceNumber.toString().padStart(12, "0")}`,
    sequenceNumber,
    activityId: "mino-story-v1",
    eventType: sequenceNumber === 1 ? "activity_started" : "step_presented",
    occurredAt: `2026-08-27T09:00:0${sequenceNumber}.000Z`,
  });
}

describe("offline interaction event synchronization", () => {
  it("keeps events queued when the network request fails", async () => {
    const store = new MemoryEventStore();
    await store.enqueue(queuedEvent(1));
    const transport: InteractionEventTransport = {
      send: async () => {
        throw new Error("offline");
      },
    };

    await expect(new InteractionEventSynchronizer(store, transport).syncOnce()).rejects.toThrow(
      "offline",
    );
    expect(await store.count()).toBe(1);
  });

  it("sends events in sequence and removes them only after success", async () => {
    const store = new MemoryEventStore();
    await store.enqueue(queuedEvent(2));
    await store.enqueue(queuedEvent(1));
    const received: number[] = [];
    const transport: InteractionEventTransport = {
      send: async (events) => {
        received.push(...events.map((event) => event.sequenceNumber));
      },
    };

    expect(await new InteractionEventSynchronizer(store, transport).drain()).toBe(2);
    expect(received).toEqual([1, 2]);
    expect(await store.count()).toBe(0);
  });

  it("does not queue the same event id twice", async () => {
    const store = new MemoryEventStore();
    const event = queuedEvent(1);
    await store.enqueue(event);
    await store.enqueue(event);
    expect(await store.count()).toBe(1);
  });
});
