import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it, vi } from "vitest";
import { createStorySelectionCards } from "./storySelection";

describe("story selection", () => {
  it("creates one card for every playable story and passes the selected story id", () => {
    const content = contentVersionSchema.parse(contentV1);
    const onSelectStory = vi.fn();
    const cards = createStorySelectionCards(content.stories, content.assets, onSelectStory);

    expect(cards).toHaveLength(content.stories.length);
    expect(cards.map((card) => card.storyId)).toEqual(content.stories.map((story) => story.id));
    expect(cards[1]?.symbol).toBe("🧱");

    cards[1]?.onPress();
    expect(onSelectStory).toHaveBeenCalledExactlyOnceWith("mino-block-tower-story");
  });

  it("places the explainable engine recommendation first without hiding other stories", () => {
    const content = contentVersionSchema.parse(contentV1);
    const cards = createStorySelectionCards(
      content.stories,
      content.assets,
      vi.fn(),
      "mino-friend-goodbye-story",
    );

    expect(cards[0]).toMatchObject({
      storyId: "mino-friend-goodbye-story",
      recommended: true,
    });
    expect(cards).toHaveLength(content.stories.length);
  });
});
