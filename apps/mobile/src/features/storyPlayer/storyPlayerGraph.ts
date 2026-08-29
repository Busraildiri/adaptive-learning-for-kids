/**
 * Pure, RN-free graph traversal for a published video_branching experience.
 * A decision clip has two playback phases for the SAME clip id: its own
 * video plays first (stage "video"), and only after that video completes
 * does the same clip become a ChoiceStage (stage "choice"). Never derive
 * the stage from clip.kind alone -- ending up straight in ChoiceStage would
 * skip the decision clip's own video.
 */
import type { PublishedPlaybackClip, PublishedStoryExperience } from "@adaptive/media-schema";

export type StoryPlayerStage =
  | { stage: "video"; clipId: string }
  | { stage: "choice"; clipId: string }
  | { stage: "finished" };

export function buildClipLookup(
  experience: PublishedStoryExperience,
): Map<string, PublishedPlaybackClip> {
  return new Map(experience.clips.map((clip) => [clip.id, clip]));
}

export function initialStage(experience: PublishedStoryExperience): StoryPlayerStage {
  return { stage: "video", clipId: experience.startClipId };
}

export function replayStage(experience: PublishedStoryExperience): StoryPlayerStage {
  return initialStage(experience);
}

export function stageAfterVideo(
  clips: Map<string, PublishedPlaybackClip>,
  clipId: string,
): StoryPlayerStage | undefined {
  const clip = clips.get(clipId);
  if (!clip) return undefined;
  if (clip.kind === "linear") return { stage: "video", clipId: clip.nextClipId };
  if (clip.kind === "ending") return { stage: "finished" };
  return { stage: "choice", clipId: clip.id };
}

export function stageAfterChoice(
  clips: Map<string, PublishedPlaybackClip>,
  clipId: string,
  optionId: string,
): StoryPlayerStage | undefined {
  const clip = clips.get(clipId);
  if (!clip || clip.kind !== "decision") return undefined;
  const option = clip.options.find((candidate) => candidate.id === optionId);
  if (!option) return undefined;
  return { stage: "video", clipId: option.nextClipId };
}
