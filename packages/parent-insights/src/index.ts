import { z } from "zod";

export const PARENT_INSIGHT_SCHEMA_VERSION = 1 as const;
export const PARENT_INSIGHT_POLICY_VERSION = "parent-insight-policy-v1" as const;
export const MINIMUM_ELIGIBLE_SESSIONS = 3;

export const recentSessionSchema = z.strictObject({
  sessionId: z.uuid(),
  activityId: z.string().trim().min(1).max(100),
  completedAt: z.iso.datetime({ offset: true }),
});

export const qualitativeObservationSchema = z.strictObject({
  code: z.enum(["continued_participation", "varied_participation"]),
  text: z.string().trim().min(1).max(240),
});

export const parentSessionSummarySchema = z.strictObject({
  schemaVersion: z.literal(PARENT_INSIGHT_SCHEMA_VERSION),
  status: z.enum(["consent_required", "no_activity", "insufficient_data", "ready"]),
  childId: z.uuid(),
  completedSessionCount: z.number().int().nonnegative(),
  eligibleSessionCount: z.number().int().nonnegative(),
  recentSessions: z.array(recentSessionSchema).max(5),
  observation: qualitativeObservationSchema.nullable(),
  generatedAt: z.iso.datetime({ offset: true }),
  policyVersion: z.literal(PARENT_INSIGHT_POLICY_VERSION),
});

export type ParentSessionSummary = z.infer<typeof parentSessionSummarySchema>;

export interface BuildParentSessionSummaryInput {
  childId: string;
  consentEnabled: boolean;
  completedSessionCount: number;
  eligibleSessionCount: number;
  distinctActivityCount: number;
  recentSessions: ParentSessionSummary["recentSessions"];
  generatedAt?: string;
}

export function buildParentSessionSummary(
  input: BuildParentSessionSummaryInput,
): ParentSessionSummary {
  let status: ParentSessionSummary["status"];
  if (!input.consentEnabled) status = "consent_required";
  else if (input.completedSessionCount === 0) status = "no_activity";
  else if (input.eligibleSessionCount < MINIMUM_ELIGIBLE_SESSIONS) status = "insufficient_data";
  else status = "ready";

  const observation =
    status !== "ready"
      ? null
      : input.distinctActivityCount >= 2
        ? {
            code: "varied_participation" as const,
            text: "Son oturumlarda birden fazla hikâyeye katıldı.",
          }
        : {
            code: "continued_participation" as const,
            text: "Son oturumlarda hikâyeyi tamamlamaya devam etti.",
          };

  return parentSessionSummarySchema.parse({
    schemaVersion: PARENT_INSIGHT_SCHEMA_VERSION,
    status,
    childId: input.childId,
    completedSessionCount: input.consentEnabled ? input.completedSessionCount : 0,
    eligibleSessionCount: input.consentEnabled ? input.eligibleSessionCount : 0,
    recentSessions: input.consentEnabled ? input.recentSessions.slice(0, 5) : [],
    observation,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    policyVersion: PARENT_INSIGHT_POLICY_VERSION,
  });
}
