import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { getEmotionPresentation } from "./emotionPresentation";

describe("emotion presentation", () => {
  it("gives every emotion a distinct non-text visual treatment", () => {
    const content = contentVersionSchema.parse(contentV1);
    const presentations = ["happy", "sad", "angry", "scared"].map((emotion) =>
      getEmotionPresentation(emotion as "happy" | "sad" | "angry" | "scared", content.assets),
    );

    expect(new Set(presentations.map((item) => item.symbol)).size).toBe(4);
    expect(new Set(presentations.map((item) => item.backgroundColor)).size).toBe(4);
    expect(presentations.every((item) => item.accessibilityLabel.length > 0)).toBe(true);
  });
});
