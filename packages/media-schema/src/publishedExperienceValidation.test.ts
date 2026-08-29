import { describe, expect, it } from "vitest";
import { validatePublishedExperienceGraph } from "./publishedExperienceValidation";
import type { PublishedStoryExperience } from "./types";

function media(mediaRef: string) {
  return { mediaRef, durationMs: 1000 };
}

function baseExperience(): PublishedStoryExperience {
  return {
    storyId: "story-1",
    storyVersion: 1,
    publishedVersion: 1,
    experienceType: "video_branching",
    title: "Test Story",
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
          { id: "hug", label: "Sarıl", nextClipId: "ending-hug", audio: media("hug.m4a") },
          { id: "balloon", label: "Balon", nextClipId: "ending-balloon", audio: media("balloon.m4a") },
        ],
      },
      { kind: "ending", id: "ending-hug", video: media("ending-hug.mp4") },
      { kind: "ending", id: "ending-balloon", video: media("ending-balloon.mp4") },
    ],
  };
}

describe("validatePublishedExperienceGraph", () => {
  it("reports no issues for a well-formed experience", () => {
    expect(validatePublishedExperienceGraph(baseExperience())).toEqual([]);
  });

  it("reports a dangling nextClipId safely instead of throwing", () => {
    const experience = baseExperience();
    experience.clips[0] = {
      kind: "linear",
      id: "scene-01",
      nextClipId: "does-not-exist",
      video: media("scene-01.mp4"),
    };

    const issues = validatePublishedExperienceGraph(experience);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.message.includes("does-not-exist"))).toBe(true);
  });

  it("reports a dangling startClipId", () => {
    const experience = baseExperience();
    experience.startClipId = "missing-start";

    const issues = validatePublishedExperienceGraph(experience);
    expect(issues.some((issue) => issue.message.includes("missing-start"))).toBe(true);
  });

  it("reports a dangling option nextClipId on a decision clip", () => {
    const experience = baseExperience();
    const decision = experience.clips[1];
    if (decision.kind !== "decision") throw new Error("fixture broken");
    decision.options = [
      decision.options[0],
      { ...decision.options[1], nextClipId: "nowhere" },
    ];

    const issues = validatePublishedExperienceGraph(experience);
    expect(issues.some((issue) => issue.message.includes("nowhere"))).toBe(true);
  });
});
