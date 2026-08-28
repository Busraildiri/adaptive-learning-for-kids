import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { isRoutineOrderCorrect, shuffledRoutineItems } from "./sequenceAndPlaceEngine";

const game = contentVersionSchema
  .parse(contentV1)
  .games?.find((candidate) => candidate.mechanic === "sequence_and_place");
if (!game || game.mechanic !== "sequence_and_place") throw new Error("Expected routine fixture.");

describe("sequence-and-place engine", () => {
  it("validates the complete configured order", () => {
    const round = game.rounds[0];
    if (!round) throw new Error("Expected a round.");
    expect(isRoutineOrderCorrect(round, round.correctOrder)).toBe(true);
    expect(isRoutineOrderCorrect(round, [...round.correctOrder].reverse())).toBe(false);
  });

  it("presents at least some rounds out of their correct order", () => {
    const round = game.rounds[0];
    if (!round) throw new Error("Expected a round.");
    expect(shuffledRoutineItems(round.items, 0).map((item) => item.id)).toEqual(
      [...round.items].reverse().map((item) => item.id),
    );
  });
});
