import type { Asset, Story } from "@adaptive/content-schema";
import { describe, expect, it } from "vitest";
import { findAssetById, storyNarratives } from "./storyCopy";

function baseStory(steps: Story["steps"]): Story {
  return {
    id: "story-1",
    version: 1,
    title: "Test Story",
    ageBands: ["2-4"],
    targetSkills: ["emotion_regulation"],
    greetingTemplate: "Merhaba!",
    experienceType: "interactive_ui",
    characterAssets: { happyAssetId: "happy", sadAssetId: "sad" },
    steps,
  };
}

describe("storyNarratives", () => {
  it("flattens an event step to its narration", () => {
    const story = baseStory([{ id: "s1", type: "event", narration: "Bir olay oldu." }]);
    expect(storyNarratives(story)).toEqual(["Bir olay oldu."]);
  });

  it("flattens a help_choice step into prompt + each choice's result narration", () => {
    const story = baseStory([
      {
        id: "help_01",
        type: "help_choice",
        prompt: "Nasıl yardım edelim?",
        choices: [
          { id: "hug", action: "hug", accessibilityLabel: "Sarıl", resultNarration: "Sarıldı." },
          {
            id: "balloon",
            action: "new_balloon",
            accessibilityLabel: "Balon bul",
            resultNarration: "Balon buldu.",
          },
        ],
      },
    ]);
    expect(storyNarratives(story)).toEqual(["Nasıl yardım edelim?", "Sarıldı.", "Balon buldu."]);
  });

  it("flattens an emotion_choice step into prompt + feedback + resolution", () => {
    const story = baseStory([
      {
        id: "e1",
        type: "emotion_choice",
        prompt: "Nasıl hissediyorsun?",
        choices: [
          {
            id: "sad",
            emotion: "sad",
            accessibilityLabel: "Üzgün",
            supportiveFeedback: { narration: "Üzgün olmak normal." },
          },
          {
            id: "angry",
            emotion: "angry",
            accessibilityLabel: "Kızgın",
            supportiveFeedback: { narration: "Kızgın olmak normal." },
          },
        ],
        storyResolution: { narration: "Şimdi daha iyi hissediyor." },
      },
    ]);
    expect(storyNarratives(story)).toEqual([
      "Nasıl hissediyorsun?",
      "Üzgün: Üzgün olmak normal.",
      "Kızgın: Kızgın olmak normal.",
      "Şimdi daha iyi hissediyor.",
    ]);
  });
});

describe("findAssetById", () => {
  const assets: Asset[] = [
    {
      id: "a1",
      type: "symbol",
      uri: "emoji:🙂",
      mimeType: "text/plain",
      accessibilityLabel: "Mutlu",
    },
    {
      id: "a2",
      type: "symbol",
      uri: "emoji:😢",
      mimeType: "text/plain",
      accessibilityLabel: "Üzgün",
    },
  ];

  it("finds an asset by id", () => {
    expect(findAssetById(assets, "a2")?.accessibilityLabel).toBe("Üzgün");
  });

  it("returns undefined for a missing or absent id", () => {
    expect(findAssetById(assets, "missing")).toBeUndefined();
    expect(findAssetById(assets, undefined)).toBeUndefined();
  });
});
