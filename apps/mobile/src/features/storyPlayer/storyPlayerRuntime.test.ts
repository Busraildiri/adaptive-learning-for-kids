import type { PublishedStoryExperience } from "@adaptive/media-schema";
import { describe, expect, it } from "vitest";
import { buildClipLookup, initialStage } from "./storyPlayerGraph";
import { reduceStoryPlayerRuntime, type StoryPlayerRuntimeState } from "./storyPlayerRuntime";

function media(mediaRef: string) {
  return { mediaRef, durationMs: 1000 };
}

function experience(): PublishedStoryExperience {
  return {
    storyId: "story-1",
    storyVersion: 1,
    publishedVersion: 1,
    experienceType: "video_branching",
    title: "Mino ve Balon",
    greetingTemplate: "Merhaba {{childName}}",
    ageBands: ["4-7"],
    startClipId: "scene-01",
    publishedAt: "2026-01-01T00:00:00.000Z",
    clips: [
      { kind: "linear", id: "scene-01", nextClipId: "help_01", video: media("scene-01.mp4") },
      {
        kind: "decision",
        id: "help_01",
        question: { text: "Nasıl yardım edelim?", audio: media("help_01-question.m4a") },
        options: [
          { id: "hug", label: "Sarıl", nextClipId: "help_01-hug", audio: media("hug.m4a") },
          {
            id: "balloon",
            label: "Balon bul",
            nextClipId: "help_01-balloon",
            audio: media("balloon.m4a"),
          },
        ],
      },
      { kind: "ending", id: "help_01-hug", video: media("help_01-hug.mp4") },
    ],
  };
}

describe("reduceStoryPlayerRuntime", () => {
  it("a rapid duplicate choice selection cannot advance the graph twice", () => {
    const exp = experience();
    const clips = buildClipLookup(exp);
    let state: StoryPlayerRuntimeState = {
      stage: { stage: "choice", clipId: "help_01" },
      advancing: false,
    };

    const first = reduceStoryPlayerRuntime(clips, exp, state, {
      type: "CHOICE_SELECT",
      clipId: "help_01",
      optionId: "hug",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");
    state = first.state;
    expect(state).toEqual({ stage: { stage: "video", clipId: "help_01-hug" }, advancing: true });

    // A second, duplicate tap arriving before STAGE_SETTLED must be a no-op.
    const second = reduceStoryPlayerRuntime(clips, exp, state, {
      type: "CHOICE_SELECT",
      clipId: "help_01",
      optionId: "balloon",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("unreachable");
    expect(second.state).toEqual(state);
  });

  it("STAGE_SETTLED clears the advancing guard so the next event is honored", () => {
    const exp = experience();
    const clips = buildClipLookup(exp);
    const advancing: StoryPlayerRuntimeState = {
      stage: { stage: "video", clipId: "help_01-hug" },
      advancing: true,
    };
    const settled = reduceStoryPlayerRuntime(clips, exp, advancing, { type: "STAGE_SETTLED" });
    expect(settled).toEqual({ ok: true, state: { ...advancing, advancing: false } });

    const next = reduceStoryPlayerRuntime(clips, exp, settled.ok ? settled.state : advancing, {
      type: "VIDEO_COMPLETE",
      clipId: "help_01-hug",
    });
    expect(next).toEqual({ ok: true, state: { stage: { stage: "finished" }, advancing: true } });
  });

  it("returns an error result (not a throw) for an unresolved transition", () => {
    const exp = experience();
    const clips = buildClipLookup(exp);
    const result = reduceStoryPlayerRuntime(
      clips,
      exp,
      { stage: initialStage(exp), advancing: false },
      { type: "VIDEO_COMPLETE", clipId: "does-not-exist" },
    );
    expect(result.ok).toBe(false);
  });

  it("REPLAY always resets to startClipId regardless of advancing state", () => {
    const exp = experience();
    const clips = buildClipLookup(exp);
    const result = reduceStoryPlayerRuntime(
      clips,
      exp,
      { stage: { stage: "finished" }, advancing: true },
      { type: "REPLAY" },
    );
    expect(result).toEqual({
      ok: true,
      state: { stage: { stage: "video", clipId: "scene-01" }, advancing: false },
    });
  });
});
