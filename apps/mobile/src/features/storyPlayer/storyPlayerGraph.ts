/**
 * Pure, RN-free graph traversal for a published video_branching experience.
 * A decision clip is the held-frame interaction that follows a video. The
 * published contract carries its question/choice audio, but no decision
 * video; therefore transitions into a decision go directly to ChoiceStage.
 * Never derive the stage from clip.kind alone: endings and linear clips still
 * have their own video stages.
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
  if (clip.kind === "linear") return stageForNextClip(clips, clip.nextClipId);
  if (clip.kind === "ending") return { stage: "finished" };
  return { stage: "choice", clipId: clip.id };
}

function stageForNextClip(
  clips: Map<string, PublishedPlaybackClip>,
  nextClipId: string,
): StoryPlayerStage | undefined {
  const nextClip = clips.get(nextClipId);
  if (!nextClip) return undefined;
  // Decision clips have no video in the published contract. They are the
  // held-frame interaction that follows the preceding video, so enter their
  // choice stage directly instead of asking VideoStage to render a decision.
  return nextClip.kind === "decision"
    ? { stage: "choice", clipId: nextClip.id }
    : { stage: "video", clipId: nextClip.id };
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
  return stageForNextClip(clips, option.nextClipId);
}
