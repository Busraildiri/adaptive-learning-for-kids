import { describe, expect, it } from "vitest";
import { publishedStoryExperienceSchema } from "./publishedExperience";

function validExperience() {
  return {
    storyId: "story-1",
    storyVersion: 1,
    publishedVersion: 1,
    experienceType: "video_branching" as const,
    title: "Test Hikaye",
    greetingTemplate: "Merhaba!",
    ageBands: ["2-4"] as const,
    startClipId: "intro",
    publishedAt: "2026-08-28T00:00:00.000Z",
    clips: [
      {
        kind: "linear" as const,
        id: "intro",
        nextClipId: "help_01",
        video: { mediaRef: "stories/story-1/fp/intro.mp4", durationMs: 4000 },
      },
      {
        kind: "decision" as const,
        id: "help_01",
        question: {
          text: "Nasıl yardım edelim?",
          audio: { mediaRef: "stories/story-1/fp/help_01-question.m4a", durationMs: 1200 },
        },
        options: [
          {
            id: "a",
            label: "Sarıl",
            nextClipId: "help_01-a",
            audio: { mediaRef: "stories/story-1/fp/help_01-a.m4a", durationMs: 900 },
          },
          {
            id: "b",
            label: "Nefes al",
            nextClipId: "help_01-b",
            audio: { mediaRef: "stories/story-1/fp/help_01-b.m4a", durationMs: 900 },
          },
        ],
      },
      {
        kind: "ending" as const,
        id: "help_01-a",
        video: { mediaRef: "stories/story-1/fp/help_01-a.mp4", durationMs: 4200 },
      },
      {
        kind: "ending" as const,
        id: "help_01-b",
        video: { mediaRef: "stories/story-1/fp/help_01-b.mp4", durationMs: 4200 },
      },
    ],
  };
}

describe("publishedStoryExperienceSchema", () => {
  it("accepts a well-formed published experience", () => {
    expect(publishedStoryExperienceSchema.safeParse(validExperience()).success).toBe(true);
  });

  it("rejects a decision clip with anything other than exactly two options", () => {
    const experience = validExperience();
    const decision = experience.clips.find((clip) => clip.kind === "decision");
    if (!decision || decision.kind !== "decision") throw new Error("fixture missing decision clip");
    decision.options = [decision.options[0]] as typeof decision.options;
    expect(publishedStoryExperienceSchema.safeParse(experience).success).toBe(false);
  });

  it("rejects an unknown top-level field (e.g. an accidental storage_path leak)", () => {
    const experience: Record<string, unknown> = {
      ...validExperience(),
      storage_path: "media-renders/story-1/x.mp4",
    };
    expect(publishedStoryExperienceSchema.safeParse(experience).success).toBe(false);
  });

  it("rejects a clip whose media ref carries an unknown field (e.g. renderId)", () => {
    const experience = validExperience();
    const clip = experience.clips[0] as Record<string, unknown>;
    (clip.video as Record<string, unknown>).renderId = "11111111-1111-1111-1111-111111111111";
    expect(publishedStoryExperienceSchema.safeParse(experience).success).toBe(false);
  });

  it("rejects experienceType values other than video_branching", () => {
    const experience: Record<string, unknown> = {
      ...validExperience(),
      experienceType: "interactive_ui",
    };
    expect(publishedStoryExperienceSchema.safeParse(experience).success).toBe(false);
  });
});
