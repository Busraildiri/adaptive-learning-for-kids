import type { AgeBand } from "@adaptive/shared-types";
import { z } from "zod";

export const CONTENT_SCHEMA_VERSION = "0.2.0" as const;

export const ageBandSchema = z.enum(["2-4", "4-7"]) satisfies z.ZodType<AgeBand>;

export const activityTypeSchema = z.enum([
  "instruction",
  "guided_practice",
  "independent_practice",
  "transfer",
]);

export const emotionIdSchema = z.enum(["happy", "sad", "angry", "scared"]);
export const assetEmotionSchema = z.enum(["happy", "sad", "angry", "scared", "neutral"]);

export const assetTypeSchema = z.enum(["image", "audio", "animation", "video", "symbol"]);

export const assetSemanticSchema = z.strictObject({
  character: z.string().trim().min(1),
  object: z.string().trim().min(1),
  eventState: z.string().trim().min(1),
  emotion: assetEmotionSchema,
  allowedNarrativeTerms: z.array(z.string().trim().min(1)).min(1),
  prohibitedNarrativeTerms: z.array(z.string().trim().min(1)),
  reviewStatus: z.enum(["pending", "approved"]),
  rightsStatus: z.enum(["needs_confirmation", "cleared"]),
  provenance: z.strictObject({
    source: z.enum(["gemini-apps", "owned", "licensed"]),
    aiGenerated: z.boolean(),
    generatedByUser: z.boolean(),
    thirdPartyReferencesDeclared: z.boolean(),
    disclosure: z.string().trim().min(1),
  }),
});

export const assetPresentationSchema = z.strictObject({
  aspectRatio: z.number().positive(),
  fit: z.enum(["cover", "contain"]),
  focalPoint: z.strictObject({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
});

export const assetSchema = z.strictObject({
  id: z.string().trim().min(1),
  type: assetTypeSchema,
  uri: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  accessibilityLabel: z.string().trim().min(1).optional(),
  semantic: assetSemanticSchema.optional(),
  presentation: assetPresentationSchema.optional(),
});

export const supportiveFeedbackSchema = z.strictObject({
  narration: z.string().trim().min(1),
  audioAssetId: z.string().trim().min(1).optional(),
  followUpPrompt: z.string().trim().min(1).optional(),
});

export const storyResolutionSchema = z.strictObject({
  narration: z.string().trim().min(1),
  audioAssetId: z.string().trim().min(1).optional(),
});

export const choiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  emotion: emotionIdSchema,
  assetId: z.string().trim().min(1),
  supportiveFeedback: supportiveFeedbackSchema,
});

export const helpActionSchema = z.enum(["hug", "new_balloon", "breathe"]);

export const storyChoiceVisualSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("balloon"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
]);

export const storyChoiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  accessibilityLabel: z.string().trim().min(1),
  visual: storyChoiceVisualSchema,
  acknowledgement: z.string().trim().min(1),
});

export const storyEmotionChoiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  emotion: emotionIdSchema,
  accessibilityLabel: z.string().trim().min(1),
  supportiveFeedback: supportiveFeedbackSchema,
});

export const storyHelpChoiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  action: helpActionSchema,
  accessibilityLabel: z.string().trim().min(1),
  resultNarration: z.string().trim().min(1),
});

export const storyStepSchema = z.discriminatedUnion("type", [
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("choice"),
    prompt: z.string().trim().min(1),
    choices: z.tuple([storyChoiceSchema, storyChoiceSchema], storyChoiceSchema),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("tap"),
    prompt: z.string().trim().min(1),
    requiredTaps: z.number().int().min(1).max(5),
    completionNarration: z.string().trim().min(1),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("event"),
    narration: z.string().trim().min(1),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("emotion_choice"),
    prompt: z.string().trim().min(1),
    choices: z.tuple(
      [storyEmotionChoiceSchema, storyEmotionChoiceSchema],
      storyEmotionChoiceSchema,
    ),
    storyResolution: storyResolutionSchema,
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("help_choice"),
    prompt: z.string().trim().min(1),
    choices: z.tuple([storyHelpChoiceSchema, storyHelpChoiceSchema], storyHelpChoiceSchema),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("breathing"),
    narration: z.string().trim().min(1),
    cycles: z.number().int().min(1).max(3),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("closing"),
    narration: z.string().trim().min(1),
  }),
]);

export const storySchema = z.strictObject({
  id: z.string().trim().min(1),
  version: z.number().int().positive(),
  title: z.string().trim().min(1),
  ageBands: z.tuple([ageBandSchema], ageBandSchema),
  targetSkills: z.array(z.string().trim().min(1)).min(1),
  greetingTemplate: z.string().trim().min(1),
  sceneAssetId: z.string().trim().min(1).optional(),
  introVideoAssetId: z.string().trim().min(1).optional(),
  characterAssets: z.strictObject({
    happyAssetId: z.string().trim().min(1),
    sadAssetId: z.string().trim().min(1),
    angryAssetId: z.string().trim().min(1).optional(),
  }),
  flowAssetIds: z.array(z.string().trim().min(1)).min(1).max(4).optional(),
  steps: z.array(storyStepSchema).min(1),
});

export const activitySchema = z.strictObject({
  id: z.string().trim().min(1),
  version: z.number().int().positive(),
  ageBands: z.tuple([ageBandSchema], ageBandSchema),
  activityType: activityTypeSchema,
  targetSkill: z.string().trim().min(1),
  sceneAssetId: z.string().trim().min(1),
  narration: z.string().trim().min(1),
  narrationAudioAssetId: z.string().trim().min(1).optional(),
  choices: z.tuple([choiceSchema, choiceSchema], choiceSchema),
  storyResolution: storyResolutionSchema,
});

export const contentStatusSchema = z.enum(["draft", "in_review", "published", "archived"]);

export const contentVersionSchema = z.strictObject({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  locale: z.literal("tr-TR"),
  status: contentStatusSchema,
  createdAt: z.iso.datetime(),
  assets: z.array(assetSchema),
  activities: z.array(activitySchema),
  stories: z.array(storySchema).min(1),
});
