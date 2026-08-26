import { describe, expect, it } from "vitest";
import contentV1 from "../content/tr-TR/content.v1.json";
import { contentVersionSchema } from "./schemas";

describe("Turkish content v1", () => {
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

  it("contains one varied playable story instead of a chain of emotion questions", () => {
    const content = contentVersionSchema.parse(contentV1);
    const story = content.stories[0];
    const stepTypes = story.steps.map((step) => step.type);

    expect(content.stories).toHaveLength(1);
    expect(story.ageBands).toContain("2-4");
    expect(stepTypes.filter((type) => type === "emotion_choice")).toHaveLength(1);
    expect(new Set(stepTypes)).toEqual(
      new Set(["choice", "tap", "event", "emotion_choice", "help_choice", "breathing", "closing"]),
    );
  });
});
