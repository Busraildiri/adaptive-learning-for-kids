/**
 * Phase 6: the mobile-facing, read-only publication contract. Deliberately
 * NOT StoryPlaybackGraph reused verbatim -- this is a separate, narrower
 * schema so a future refactor of the production graph/media-job shape can
 * never accidentally widen what reaches a mobile client. Branching
 * semantics are preserved (id-based navigation via nextClipId /
 * choice.options[].nextClipId), but every field here is safe-to-ship:
 * no storage_path, no render_id, no job/provider/error internals, no
 * signed URLs (those are minted on demand from `mediaRef` by a future
 * mobile-side resolver, never persisted here).
 */
import { ageBandSchema } from "@adaptive/content-schema";
import { z } from "zod";

// `mediaRef` is an opaque durable reference (today: a relative object key
// inside the published-story-media bucket) -- callers must never construct
// or parse it themselves; it is only ever passed to a future
// resolvePublishedMedia(mediaRef) that knows how to turn it into a
// short-lived signed URL.
export const publishedMediaRefSchema = z.strictObject({
  mediaRef: z.string().trim().min(1),
  durationMs: z.number().int().positive(),
});

export const publishedChoiceOptionSchema = z.strictObject({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  nextClipId: z.string().trim().min(1),
  audio: publishedMediaRefSchema,
});

export const publishedPlaybackClipSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("linear"),
    id: z.string().trim().min(1),
    nextClipId: z.string().trim().min(1),
    video: publishedMediaRefSchema,
  }),
  z.strictObject({
    kind: z.literal("ending"),
    id: z.string().trim().min(1),
    video: publishedMediaRefSchema,
  }),
  z.strictObject({
    kind: z.literal("decision"),
    id: z.string().trim().min(1),
    question: z.strictObject({
      text: z.string().trim().min(1),
      audio: publishedMediaRefSchema,
    }),
    // Mirrors StoryPlaybackGraph's Choice contract: exactly two options,
    // enforced by a fixed tuple rather than a variable-length array.
    options: z.tuple([publishedChoiceOptionSchema, publishedChoiceOptionSchema]),
  }),
]);

export const publishedStoryExperienceSchema = z.strictObject({
  storyId: z.string().trim().min(1),
  storyVersion: z.number().int().positive(),
  publishedVersion: z.number().int().positive(),
  experienceType: z.literal("video_branching"),
  title: z.string().trim().min(1),
  greetingTemplate: z.string().trim().min(1),
  ageBands: z.array(ageBandSchema).min(1),
  startClipId: z.string().trim().min(1),
  clips: z.array(publishedPlaybackClipSchema).min(1),
  publishedAt: z.string().trim().min(1),
  // Optional, additive: a story-specific character name and cover image
  // reference (an opaque mediaRef, same as clip video/audio) for a richer
  // selection-screen card than the generic fallback symbol. Absent on
  // experiences published before these existed.
  characterName: z.string().trim().min(1).optional(),
  coverMediaRef: z.string().trim().min(1).optional(),
});
