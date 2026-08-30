import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { objectMatchesRound, outcomeForSortAttempt } from "./classifyAndSortEngine";

const game = contentVersionSchema
  .parse(contentV1)
  .games?.find((candidate) => candidate.mechanic === "classify_and_sort");
if (!game || game.mechanic !== "classify_and_sort") {
  throw new Error("Expected a classify-and-sort fixture.");
}

describe("classify-and-sort engine", () => {
  it("keeps an instruction for every adaptive source round", () => {
    expect(game.rounds.every((round) => round.instruction.length > 0)).toBe(true);
  });

  it("matches each round by its active dimension", () => {
    for (const round of game.rounds) {
      expect(round.objects.filter((object) => objectMatchesRound(object, round))).toHaveLength(1);
    }
  });

  it("distinguishes a matching object from a retry", () => {
    const round = game.rounds[0];
    if (!round) throw new Error("Expected a round.");
    const correct = round.objects.find((object) => objectMatchesRound(object, round));
    const incorrect = round.objects.find((object) => !objectMatchesRound(object, round));
    if (!correct || !incorrect) throw new Error("Expected matching and non-matching objects.");
    expect(outcomeForSortAttempt(correct, round)).toBe("matched");
    expect(outcomeForSortAttempt(incorrect, round)).toBe("retry");
  });
});
