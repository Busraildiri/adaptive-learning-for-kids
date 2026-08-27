import type { InteractionEvent } from "@adaptive/analytics-events";
import { z } from "zod";

export const evidenceClassificationSchema = z.enum([
  "valid_evidence",
  "limited_evidence",
  "interaction_noise",
  "not_evaluated",
]);
export type EvidenceClassification = z.infer<typeof evidenceClassificationSchema>;

export const evidenceThresholdsSchema = z.strictObject({
  version: z.string().trim().min(1).max(40),
  minimumResponseMs: z.number().int().min(0).max(60_000),
  minimumDistinctResponses: z.number().int().min(1).max(20),
  maximumDuplicateRatio: z.number().min(0).max(1),
});
export type EvidenceThresholds = z.infer<typeof evidenceThresholdsSchema>;

export const DEFAULT_EVIDENCE_THRESHOLDS: EvidenceThresholds = {
  version: "evidence-thresholds-v1",
  minimumResponseMs: 700,
  minimumDistinctResponses: 2,
  maximumDuplicateRatio: 0.6,
};

export interface NormalizedResponse {
  stepId: string;
  choiceId: string;
  responseMs: number | null;
  sourceEventId: string;
}

export interface SessionEvidence {
  sessionId: string;
  childId: string;
  activityId: string;
  classification: EvidenceClassification;
  reasonCode:
    | "completed_with_multiple_responses"
    | "completed_with_limited_responses"
    | "single_fast_response"
    | "duplicate_dominated_interaction"
    | "activity_not_completed"
    | "no_evaluable_response";
  responses: NormalizedResponse[];
  duplicateResponseCount: number;
  thresholdVersion: string;
}

function millisecondsBetween(start: string, end: string): number {
  return Math.max(0, Date.parse(end) - Date.parse(start));
}

export function normalizeResponses(events: InteractionEvent[]): {
  responses: NormalizedResponse[];
  duplicateResponseCount: number;
} {
  const ordered = [...events].sort((left, right) => left.sequenceNumber - right.sequenceNumber);
  const presentedAt = new Map<string, string>();
  const seenSteps = new Set<string>();
  const responses: NormalizedResponse[] = [];
  let duplicateResponseCount = 0;

  for (const event of ordered) {
    const stepId = typeof event.payload.stepId === "string" ? event.payload.stepId : null;
    if (!stepId) continue;

    if (event.eventType === "step_presented") {
      presentedAt.set(stepId, event.occurredAt);
      continue;
    }
    if (event.eventType !== "choice_selected" && event.eventType !== "hint_requested") continue;

    if (seenSteps.has(stepId)) {
      duplicateResponseCount += 1;
      continue;
    }

    const choice = event.payload.choiceId ?? event.payload.action;
    if (typeof choice !== "string") continue;
    seenSteps.add(stepId);
    const presentation = presentedAt.get(stepId);
    responses.push({
      stepId,
      choiceId: choice,
      responseMs: presentation ? millisecondsBetween(presentation, event.occurredAt) : null,
      sourceEventId: event.eventId,
    });
  }

  return { responses, duplicateResponseCount };
}

export function classifySessionEvidence(
  events: InteractionEvent[],
  thresholds: EvidenceThresholds = DEFAULT_EVIDENCE_THRESHOLDS,
): SessionEvidence {
  const resolvedThresholds = evidenceThresholdsSchema.parse(thresholds);
  const first = events[0];
  if (!first) throw new Error("At least one interaction event is required.");
  const { responses, duplicateResponseCount } = normalizeResponses(events);
  const completed = events.some((event) => event.eventType === "activity_completed");
  const totalResponseEvents = responses.length + duplicateResponseCount;
  const duplicateRatio =
    totalResponseEvents === 0 ? 0 : duplicateResponseCount / totalResponseEvents;

  let classification: EvidenceClassification;
  let reasonCode: SessionEvidence["reasonCode"];

  if (!completed) {
    classification =
      duplicateRatio > resolvedThresholds.maximumDuplicateRatio
        ? "interaction_noise"
        : "not_evaluated";
    reasonCode =
      classification === "interaction_noise"
        ? "duplicate_dominated_interaction"
        : "activity_not_completed";
  } else if (responses.length === 0) {
    classification = "not_evaluated";
    reasonCode = "no_evaluable_response";
  } else if (
    responses.length === 1 &&
    responses[0]?.responseMs !== null &&
    (responses[0]?.responseMs ?? 0) < resolvedThresholds.minimumResponseMs
  ) {
    classification = "limited_evidence";
    reasonCode = "single_fast_response";
  } else if (responses.length < resolvedThresholds.minimumDistinctResponses) {
    classification = "limited_evidence";
    reasonCode = "completed_with_limited_responses";
  } else {
    classification = "valid_evidence";
    reasonCode = "completed_with_multiple_responses";
  }

  return {
    sessionId: first.sessionId,
    childId: first.childId,
    activityId: first.activityId,
    classification,
    reasonCode,
    responses,
    duplicateResponseCount,
    thresholdVersion: resolvedThresholds.version,
  };
}

export interface ActivityCandidate {
  activityId: string;
  completionCount: number;
  lastCompletedAt: string | null;
}

export interface ActivityDecision {
  selectedActivityId: string;
  reasonCode: "unseen_activity" | "least_practiced" | "least_recently_completed";
  explanation: string;
  thresholdVersion: string;
}

export function selectNextActivity(
  candidates: ActivityCandidate[],
  thresholds: EvidenceThresholds = DEFAULT_EVIDENCE_THRESHOLDS,
): ActivityDecision {
  if (candidates.length === 0) throw new Error("At least one activity candidate is required.");
  const thresholdVersion = evidenceThresholdsSchema.parse(thresholds).version;
  const ordered = [...candidates].sort((left, right) => {
    if (left.completionCount !== right.completionCount) {
      return left.completionCount - right.completionCount;
    }
    if (left.lastCompletedAt === null) return -1;
    if (right.lastCompletedAt === null) return 1;
    return left.lastCompletedAt.localeCompare(right.lastCompletedAt);
  });
  const selected = ordered[0];
  if (!selected) throw new Error("Activity selection failed.");

  const unseen = selected.completionCount === 0;
  const sameCount = ordered.filter(
    (candidate) => candidate.completionCount === selected.completionCount,
  );
  const reasonCode = unseen
    ? "unseen_activity"
    : sameCount.length > 1
      ? "least_recently_completed"
      : "least_practiced";

  return {
    selectedActivityId: selected.activityId,
    reasonCode,
    explanation: unseen
      ? "Henüz tamamlanmamış bir etkinlik öne çıkarıldı."
      : reasonCode === "least_practiced"
        ? "Daha az tamamlanan bir etkinlik öne çıkarıldı."
        : "En uzun süredir tamamlanmayan etkinlik öne çıkarıldı.",
    thresholdVersion,
  };
}
