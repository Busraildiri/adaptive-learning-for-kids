import { z } from "zod";
import { collectGraphIssues } from "./graphValidation";

export const MEDIA_SCHEMA_VERSION = "0.1.0" as const;

// --- Playback topology (immutable structure: what can be shown and in what
// order/branches). Deliberately carries no render/media fields -- those live
// in ClipMediaState below, kept as a separate model from the topology.

export const clipRenderStatusSchema = z.enum(["pending", "rendering", "ready", "failed"]);

export const clipMediaStateSchema = z.strictObject({
  clipId: z.string().trim().min(1),
  status: clipRenderStatusSchema,
  videoUrl: z.string().trim().min(1).optional(),
  durationMs: z.number().int().positive().optional(),
  error: z.string().trim().min(1).optional(),
});

// Topology/semantics only -- no media reference here. A ChoiceOption's
// narration is *audio content* to produce, not a place to cache where it
// ended up: that mutable state (status/storagePath/durationMs) lives in
// Phase 4's story_choice_media table, keyed by (graphId, decisionClipId,
// audioRole, choiceId). Same reasoning as PlaybackClip/ClipMediaState in
// Phase 1 -- this was inconsistently applied to Choice/ChoiceOption
// originally and is corrected here (Phase 4).
export const choiceOptionSchema = z.strictObject({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  nextClipId: z.string().trim().min(1),
});

export const choiceSchema = z.strictObject({
  question: z.string().trim().min(1),
  // MVP is exactly two options -- a fixed (non-rest) tuple enforces this at
  // both parse time and compile time. Widen deliberately later, not by accident.
  options: z.tuple([choiceOptionSchema, choiceOptionSchema]),
});

export const playbackClipSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("linear"),
    id: z.string().trim().min(1),
    sourceSceneId: z.string().trim().min(1),
    role: z.string().trim().min(1).optional(),
    nextClipId: z.string().trim().min(1),
  }),
  z.strictObject({
    kind: z.literal("decision"),
    id: z.string().trim().min(1),
    sourceSceneId: z.string().trim().min(1),
    role: z.string().trim().min(1).optional(),
    choice: choiceSchema,
  }),
  z.strictObject({
    kind: z.literal("ending"),
    id: z.string().trim().min(1),
    sourceSceneId: z.string().trim().min(1),
    role: z.string().trim().min(1).optional(),
  }),
]);

const storyPlaybackGraphShapeSchema = z.strictObject({
  // The graph's own identity -- independent of content_generation_runs.
  // sourceRequestId below is provenance/audit only, never a lookup key.
  id: z.string().trim().min(1),
  storyId: z.string().trim().min(1),
  storyVersion: z.number().int().positive(),
  sourceRequestId: z.string().trim().min(1).optional(),
  startClipId: z.string().trim().min(1),
  clips: z.array(playbackClipSchema).min(1),
});

export const storyPlaybackGraphSchema = storyPlaybackGraphShapeSchema.superRefine((graph, ctx) => {
  for (const issue of collectGraphIssues(graph)) {
    ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
});

// --- Combined read-side DTOs (topology + state), for callers that want both
// joined -- e.g. an admin preview screen. Not the persisted/authored shape.

export const playbackClipWithStateSchema = z.strictObject({
  clip: playbackClipSchema,
  media: clipMediaStateSchema,
});
