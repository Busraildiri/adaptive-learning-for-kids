import type { PublishedStoryExperience } from "@adaptive/media-schema";
import { describe, expect, it, vi } from "vitest";
import { createPublishedStorySelectionCards } from "./publishedStorySelection";

function experience(
  storyId: string,
  title: string,
  coverMediaRef?: string,
): PublishedStoryExperience {
  return {
    storyId,
    storyVersion: 1,
    publishedVersion: 1,
    experienceType: "video_branching",
    title,
    greetingTemplate: "Merhaba {{childName}}",
    ageBands: ["4-7"],
    startClipId: "scene-01",
    publishedAt: "2026-01-01T00:00:00.000Z",
    coverMediaRef,
    clips: [{ kind: "ending", id: "scene-01", video: { mediaRef: "a.mp4", durationMs: 1000 } }],
  };
}

describe("createPublishedStorySelectionCards", () => {
  it("builds one card per experience with the title and a working onPress", () => {
    const onSelectStory = vi.fn();
    const cards = createPublishedStorySelectionCards(
      [experience("story-1", "Mino ve Balon", "stories/story-1/intro.mp4")],
      onSelectStory,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe("Mino ve Balon");
    expect(cards[0]?.coverMediaRef).toBe("stories/story-1/intro.mp4");
    cards[0]?.onPress();
    expect(onSelectStory).toHaveBeenCalledWith("story-1");
  });

  it("returns an empty list for an empty catalog", () => {
    expect(createPublishedStorySelectionCards([], vi.fn())).toEqual([]);
  });

  it("uses the opening video for publications created before coverMediaRef existed", () => {
    const cards = createPublishedStorySelectionCards(
      [experience("legacy-story", "Eski Hikâye")],
      vi.fn(),
    );
    expect(cards[0]?.coverMediaRef).toBe("a.mp4");
  });
});
