import { describe, expect, it } from "vitest";
import contentV1 from "../content/tr-TR/content.v1.json";
import { contentVersionSchema } from "./schemas";

describe("Turkish content v1", () => {
  it("registers the Mırmır red-balloon pack with locked semantic metadata", () => {
    const content = contentVersionSchema.parse(contentV1);
    const assets = content.assets.filter((asset) => asset.id.startsWith("character-mirmir-"));

    expect(assets).toHaveLength(3);
    expect(assets.map((asset) => asset.semantic?.eventState)).toEqual([
      "holding",
      "popped",
      "playing",
    ]);
    expect(assets.map((asset) => asset.semantic?.emotion)).toEqual(["happy", "sad", "happy"]);
    expect(assets.every((asset) => asset.semantic?.rightsStatus === "cleared")).toBe(true);
    expect(assets.every((asset) => asset.semantic?.provenance.source === "gemini-apps")).toBe(true);
  });
  it("contains six valid activities", () => {
    const content = contentVersionSchema.parse(contentV1);

    expect(content.activities).toHaveLength(6);
  });

  it("covers all four activity types", () => {
    const content = contentVersionSchema.parse(contentV1);
    const activityTypes = new Set(content.activities.map((activity) => activity.activityType));

    expect(activityTypes).toEqual(
      new Set(["instruction", "guided_practice", "independent_practice", "transfer"]),
    );
  });

  it("provides unique ids and supportive feedback for every choice", () => {
    const content = contentVersionSchema.parse(contentV1);
    const activityIds = content.activities.map((activity) => activity.id);

    expect(new Set(activityIds).size).toBe(activityIds.length);

    for (const activity of content.activities) {
      expect(activity.storyResolution.narration.length).toBeGreaterThan(0);

      for (const choice of activity.choices) {
        expect(choice.supportiveFeedback.narration.length).toBeGreaterThan(0);
        expect(choice).not.toHaveProperty("isCorrect");
      }
    }
  });

  it("contains five valid playable stories so the personalization gate is reachable", () => {
    const content = contentVersionSchema.parse(contentV1);
    const story = content.stories[0];
    const stepTypes = story.steps.map((step) => step.type);

    expect(content.stories).toHaveLength(5);
    expect(story.ageBands).toContain("2-4");
    expect(stepTypes.filter((type) => type === "emotion_choice")).toHaveLength(1);
    expect(new Set(stepTypes)).toEqual(
      new Set(["choice", "tap", "event", "emotion_choice", "help_choice", "breathing", "closing"]),
    );
  });

  it("uses existing scene symbols and gives every emotion its own non-judgmental feedback", () => {
    const content = contentVersionSchema.parse(contentV1);
    const expectedSceneAssets = new Set([
      "scene-block-tower",
      "scene-friend-goodbye",
      "scene-lost-toy",
    ]);
    const newStories = content.stories.filter(
      (story) => story.id !== "mino-balloon-story" && story.id.startsWith("mino-"),
    );

    expect(new Set(newStories.map((story) => story.sceneAssetId))).toEqual(expectedSceneAssets);

    for (const story of content.stories) {
      const emotionSteps = story.steps.filter((step) => step.type === "emotion_choice");
      expect(emotionSteps.length).toBeGreaterThanOrEqual(1);

      for (const step of emotionSteps) {
        for (const choice of step.choices) {
          expect(choice.supportiveFeedback.narration.length).toBeGreaterThan(0);
          expect(choice).not.toHaveProperty("isCorrect");
          expect(choice).not.toHaveProperty("correctAnswer");
        }
      }
    }
  });
});
