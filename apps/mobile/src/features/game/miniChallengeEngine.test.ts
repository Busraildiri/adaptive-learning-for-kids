import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { choicesAfterCorrectAnswer, expectedChoiceId } from "./miniChallengeEngine";

const content = contentVersionSchema.parse(contentV1);
const zuzu = content.games?.find((game) => game.id === "zuzu-missing-piece-001");

if (!zuzu || zuzu.mechanic !== "mini_challenge") {
  throw new Error("Expected the Zuzu mini challenge fixture.");
}

describe("mini challenge engine", () => {
  it("evaluates Zuzu's second single-choice round independently of prior answers", () => {
    const secondRound = zuzu.rounds[1];
    if (!secondRound) throw new Error("Expected Zuzu's second round.");

    expect(expectedChoiceId(secondRound, 1)).toBe("star");
    expect(choicesAfterCorrectAnswer(secondRound, ["circle"], "star")).toEqual(["star"]);
  });

  it("keeps progressive sequence rounds indexed by the entered choices", () => {
    const toko = content.games?.find((game) => game.id === "toko-little-map-001");
    if (!toko || toko.mechanic !== "mini_challenge") {
      throw new Error("Expected the Toko mini challenge fixture.");
    }
    const sequenceRound = toko.rounds.find((round) => round.correctSequence.length > 1);
    if (!sequenceRound) throw new Error("Expected a progressive Toko round.");

    expect(expectedChoiceId(sequenceRound, 1)).toBe(sequenceRound.correctSequence[1]);
  });
});
