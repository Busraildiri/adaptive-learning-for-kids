import type { z } from "zod";
import type {
  publishedChoiceOptionSchema,
  publishedMediaRefSchema,
  publishedPlaybackClipSchema,
  publishedStoryExperienceSchema,
} from "./publishedExperience";
import type {
  choiceOptionSchema,
  choiceSchema,
  clipMediaStateSchema,
  clipRenderStatusSchema,
  playbackClipSchema,
  playbackClipWithStateSchema,
  storyPlaybackGraphSchema,
} from "./schemas";

export type ClipRenderStatus = z.infer<typeof clipRenderStatusSchema>;
export type ClipMediaState = z.infer<typeof clipMediaStateSchema>;
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type PlaybackClip = z.infer<typeof playbackClipSchema>;
export type StoryPlaybackGraph = z.infer<typeof storyPlaybackGraphSchema>;
export type PlaybackClipWithState = z.infer<typeof playbackClipWithStateSchema>;

export interface StoryPlaybackGraphWithState {
  id: string;
  storyId: string;
  storyVersion: number;
  sourceRequestId?: string;
  startClipId: string;
  clips: PlaybackClipWithState[];
}

export type PublishedMediaRef = z.infer<typeof publishedMediaRefSchema>;
export type PublishedChoiceOption = z.infer<typeof publishedChoiceOptionSchema>;
export type PublishedPlaybackClip = z.infer<typeof publishedPlaybackClipSchema>;
export type PublishedStoryExperience = z.infer<typeof publishedStoryExperienceSchema>;
