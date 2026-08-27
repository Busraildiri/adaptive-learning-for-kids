import { z } from "zod";

export const INTERACTION_EVENT_SCHEMA_VERSION = 1 as const;
export const MAX_SYNC_BATCH_SIZE = 100;

export const interactionEventTypeSchema = z.enum([
  "activity_started",
  "step_presented",
  "choice_selected",
  "hint_requested",
  "activity_completed",
  "activity_abandoned",
]);

export type InteractionEventType = z.infer<typeof interactionEventTypeSchema>;

const payloadValueSchema = z.union([
  z.string().max(100),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const interactionEventPayloadSchema = z
  .record(z.string().regex(/^[a-z][a-zA-Z0-9]{0,39}$/), payloadValueSchema)
  .superRefine((payload, context) => {
    if (Object.keys(payload).length > 8) {
      context.addIssue({ code: "custom", message: "Payload can contain at most 8 fields." });
    }
    if (JSON.stringify(payload).length > 1_024) {
      context.addIssue({ code: "custom", message: "Payload exceeds 1024 bytes." });
    }
  });

export const interactionEventSchema = z
  .object({
    schemaVersion: z.literal(INTERACTION_EVENT_SCHEMA_VERSION),
    eventId: z.uuid(),
    sessionId: z.uuid(),
    sequenceNumber: z.number().int().positive(),
    childId: z.uuid(),
    activityId: z.string().trim().min(1).max(100),
    eventType: interactionEventTypeSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    payload: interactionEventPayloadSchema,
  })
  .strict();

export type InteractionEvent = z.infer<typeof interactionEventSchema>;

export const interactionEventBatchSchema = z
  .array(interactionEventSchema)
  .min(1)
  .max(MAX_SYNC_BATCH_SIZE)
  .superRefine((events, context) => {
    const first = events[0];
    if (!first) return;

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (!event) continue;

      if (event.childId !== first.childId || event.sessionId !== first.sessionId) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "A batch must contain one child and one activity session.",
        });
      }

      const previous = events[index - 1];
      if (previous && event.sequenceNumber <= previous.sequenceNumber) {
        context.addIssue({
          code: "custom",
          path: [index, "sequenceNumber"],
          message: "Events must be ordered by increasing sequence number.",
        });
      }
    }
  });

export interface CreateInteractionEventInput {
  eventId: string;
  sessionId: string;
  sequenceNumber: number;
  childId: string;
  activityId: string;
  eventType: InteractionEventType;
  occurredAt?: string;
  payload?: Record<string, string | number | boolean | null>;
}

export function createInteractionEvent(input: CreateInteractionEventInput): InteractionEvent {
  return interactionEventSchema.parse({
    schemaVersion: INTERACTION_EVENT_SCHEMA_VERSION,
    occurredAt: new Date().toISOString(),
    payload: {},
    ...input,
  });
}
