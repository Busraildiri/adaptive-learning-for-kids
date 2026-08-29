/**
 * Wraps storyPlayerGraph's pure transitions with a single "advancing" guard
 * so a duplicate completion callback (e.g. two playToEnd events, or a rapid
 * double-tap on a choice) can never advance the graph twice. Kept pure and
 * separate from React state so the guard itself is unit-testable without
 * rendering StoryPlayer.
 */
import type { PublishedPlaybackClip, PublishedStoryExperience } from "@adaptive/media-schema";
import { replayStage, stageAfterChoice, stageAfterVideo, type StoryPlayerStage } from "./storyPlayerGraph";

export interface StoryPlayerRuntimeState {
  stage: StoryPlayerStage;
  advancing: boolean;
}

export type StoryPlayerEvent =
  | { type: "VIDEO_COMPLETE"; clipId: string }
  | { type: "CHOICE_SELECT"; clipId: string; optionId: string }
  | { type: "STAGE_SETTLED" }
  | { type: "REPLAY" };

export type StoryPlayerRuntimeResult =
  | { ok: true; state: StoryPlayerRuntimeState }
  | { ok: false; error: string };

export function reduceStoryPlayerRuntime(
  clips: Map<string, PublishedPlaybackClip>,
  experience: PublishedStoryExperience,
  state: StoryPlayerRuntimeState,
  event: StoryPlayerEvent,
): StoryPlayerRuntimeResult {
  if (event.type === "REPLAY") {
    return { ok: true, state: { stage: replayStage(experience), advancing: false } };
  }
  if (event.type === "STAGE_SETTLED") {
    return { ok: true, state: { ...state, advancing: false } };
  }
  if (state.advancing) {
    // Already mid-transition -- ignore the duplicate event rather than
    // advancing the graph a second time.
    return { ok: true, state };
  }

  if (event.type === "VIDEO_COMPLETE") {
    const next = stageAfterVideo(clips, event.clipId);
    if (!next) return { ok: false, error: `No stage resolves after video clip "${event.clipId}"` };
    return { ok: true, state: { stage: next, advancing: true } };
  }

  const next = stageAfterChoice(clips, event.clipId, event.optionId);
  if (!next) {
    return {
      ok: false,
      error: `No stage resolves after choice "${event.optionId}" on clip "${event.clipId}"`,
    };
  }
  return { ok: true, state: { stage: next, advancing: true } };
}
