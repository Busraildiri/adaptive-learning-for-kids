import { describe, expect, it } from "vitest";
import type { PublishedStoryExperience } from "@adaptive/media-schema";
import {
  buildClipLookup,
  initialStage,
  replayStage,
  stageAfterChoice,
  stageAfterVideo,
} from "./storyPlayerGraph";

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
          { id: "balloon", label: "Balon bul", nextClipId: "help_01-balloon", audio: media("balloon.m4a") },
        ],
      },
      { kind: "ending", id: "help_01-hug", video: media("help_01-hug.mp4") },
      { kind: "ending", id: "help_01-balloon", video: media("help_01-balloon.mp4") },
    ],
  };
}

describe("storyPlayerGraph", () => {
  it("begins at startClipId in the video stage", () => {
    expect(initialStage(experience())).toEqual({ stage: "video", clipId: "scene-01" });
  });

  it("a linear clip's video completion moves to the next clip's video stage", () => {
    const clips = buildClipLookup(experience());
    expect(stageAfterVideo(clips, "scene-01")).toEqual({ stage: "video", clipId: "help_01" });
  });

  it("a decision clip's video completion moves to the SAME clip's choice stage", () => {
    const clips = buildClipLookup(experience());
    expect(stageAfterVideo(clips, "help_01")).toEqual({ stage: "choice", clipId: "help_01" });
  });

  it("selecting option A enters option A's nextClipId video stage", () => {
    const clips = buildClipLookup(experience());
    expect(stageAfterChoice(clips, "help_01", "hug")).toEqual({
      stage: "video",
      clipId: "help_01-hug",
    });
  });

  it("selecting option B enters option B's nextClipId video stage", () => {
    const clips = buildClipLookup(experience());
    expect(stageAfterChoice(clips, "help_01", "balloon")).toEqual({
      stage: "video",
      clipId: "help_01-balloon",
    });
  });

  it("an ending clip's video completion moves to finished", () => {
    const clips = buildClipLookup(experience());
    expect(stageAfterVideo(clips, "help_01-hug")).toEqual({ stage: "finished" });
  });

  it("replay returns to startClipId's video stage", () => {
    expect(replayStage(experience())).toEqual({ stage: "video", clipId: "scene-01" });
  });

  it("fails safely (undefined) for an unknown clip id", () => {
    const clips = buildClipLookup(experience());
    expect(stageAfterVideo(clips, "does-not-exist")).toBeUndefined();
  });

  it("fails safely (undefined) for an unknown option id", () => {
    const clips = buildClipLookup(experience());
    expect(stageAfterChoice(clips, "help_01", "does-not-exist")).toBeUndefined();
  });
});
