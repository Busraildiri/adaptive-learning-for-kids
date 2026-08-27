import type { z } from "zod";
import type {
  activitySchema,
  activityTypeSchema,
  ageBandSchema,
  assetPresentationSchema,
  assetSchema,
  assetSemanticSchema,
  assetTypeSchema,
  choiceSchema,
  contentStatusSchema,
  contentVersionSchema,
  emotionIdSchema,
  helpActionSchema,
  storyChoiceSchema,
  storyEmotionChoiceSchema,
  storyHelpChoiceSchema,
  storyResolutionSchema,
  storySchema,
  storyStepSchema,
  supportiveFeedbackSchema,
} from "./schemas";

export type AgeBand = z.infer<typeof ageBandSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type EmotionId = z.infer<typeof emotionIdSchema>;
export type HelpAction = z.infer<typeof helpActionSchema>;
export type AssetType = z.infer<typeof assetTypeSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetPresentation = z.infer<typeof assetPresentationSchema>;
export type AssetSemantic = z.infer<typeof assetSemanticSchema>;
export type SupportiveFeedback = z.infer<typeof supportiveFeedbackSchema>;
export type StoryResolution = z.infer<typeof storyResolutionSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type StoryChoice = z.infer<typeof storyChoiceSchema>;
export type StoryEmotionChoice = z.infer<typeof storyEmotionChoiceSchema>;
export type StoryHelpChoice = z.infer<typeof storyHelpChoiceSchema>;
export type StoryStep = z.infer<typeof storyStepSchema>;
export type Story = z.infer<typeof storySchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type ContentVersion = z.infer<typeof contentVersionSchema>;
