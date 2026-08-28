import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { isClueChoiceCorrect, isEmotionChoiceCorrect } from "./emotionCluesEngine";

const content = contentVersionSchema.parse(contentV1);
const game = content.games?.find((candidate) => candidate.mechanic === "emotion_clues");

describe("emotion clues engine", () => {
  it("checks both the emotion and its visual clue", () => {
    if (!game || game.mechanic !== "emotion_clues") throw new Error("Emotion game fixture missing");
    const round = game.rounds[0];
    expect(isEmotionChoiceCorrect(round, "sad")).toBe(true);
    expect(isEmotionChoiceCorrect(round, "happy")).toBe(false);
    expect(isClueChoiceCorrect(round, "eyes")).toBe(true);
    expect(isClueChoiceCorrect(round, "mouth")).toBe(false);
  });
});
