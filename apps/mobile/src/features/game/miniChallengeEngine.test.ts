import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import {
  adaptRhythmRound,
  choicesAfterCorrectAnswer,
  expectedChoiceId,
} from "./miniChallengeEngine";

const content = contentVersionSchema.parse(contentV1);
const zuzu = content.games?.find((game) => game.id === "zuzu-missing-piece-001");
const nino = content.games?.find((game) => game.id === "nino-sound-rhythm-001");
const maya = content.games?.find((game) => game.id === "maya-morning-order-001");

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

  it("keeps Maya on the current sequence after its first correct choice", () => {
    if (!maya || maya.mechanic !== "mini_challenge") {
      throw new Error("Expected the Maya mini challenge fixture.");
    }
    const round = maya.rounds.find((candidate) => candidate.correctSequence.length > 1);
    if (!round) throw new Error("Expected a progressive Maya round.");

    const entered = choicesAfterCorrectAnswer(round, [], round.correctSequence[0] as string);

    expect(entered).toHaveLength(1);
    expect(entered.length).toBeLessThan(round.correctSequence.length);
    expect(expectedChoiceId(round, entered.length)).toBe(round.correctSequence[1]);
  });

  it("includes Maya's new morning activities", () => {
    if (!maya || maya.mechanic !== "mini_challenge") {
      throw new Error("Expected the Maya mini challenge fixture.");
    }
    const choiceIds = new Set(
      maya.rounds.flatMap((round) => round.choices.map((choice) => choice.id)),
    );

    expect(choiceIds.has("wash")).toBe(true);
    expect(choiceIds.has("comb")).toBe(true);
    expect(choiceIds.has("shoes")).toBe(true);
  });

  it("follows Nino's fixed two, three, and four sound curriculum", () => {
    if (!nino || nino.mechanic !== "mini_challenge") {
      throw new Error("Expected the Nino mini challenge fixture.");
    }
    const rhythmRound = nino.rounds.find((round) => round.kind === "rhythm");
    if (!rhythmRound || rhythmRound.kind !== "rhythm") {
      throw new Error("Expected a Nino rhythm round.");
    }

    const first = adaptRhythmRound(rhythmRound, 0);
    const second = adaptRhythmRound(rhythmRound, 1);
    const firstThreeSoundRound = adaptRhythmRound(rhythmRound, 2);
    const firstFourSoundRound = adaptRhythmRound(rhythmRound, 5);

    expect(first.choices.map((choice) => choice.id)).toEqual([
      "drum",
      "tambourine",
      "xylophone",
      "triangle",
    ]);
    expect(first.correctSequence).toEqual(["drum", "tambourine"]);
    expect(second.correctSequence).toEqual(["xylophone", "triangle"]);
    expect(firstThreeSoundRound.correctSequence).toEqual(["tambourine", "xylophone", "triangle"]);
    expect(firstFourSoundRound.correctSequence).toEqual([
      "guitar",
      "wood-block",
      "trumpet",
      "cymbals",
    ]);
  });

  it("always shows four choices while increasing only the sequence length", () => {
    if (!nino || nino.mechanic !== "mini_challenge") {
      throw new Error("Expected the Nino mini challenge fixture.");
    }
    const rhythmRound = nino.rounds.find((round) => round.kind === "rhythm");
    if (!rhythmRound || rhythmRound.kind !== "rhythm") {
      throw new Error("Expected a Nino rhythm round.");
    }

    const rounds = Array.from({ length: 9 }, (_, challengeIndex) =>
      adaptRhythmRound(rhythmRound, challengeIndex),
    );

    expect(rounds.map((round) => round.choices.length)).toEqual(Array(9).fill(4));
    expect(rounds.map((round) => round.correctSequence.length)).toEqual([
      2, 2, 3, 3, 3, 4, 4, 4, 4,
    ]);
    for (const round of rounds) {
      const choiceIds = new Set(round.choices.map((choice) => choice.id));
      round.correctSequence.forEach((id) => expect(choiceIds.has(id)).toBe(true));
    }
    const laterChoiceIds = new Set(
      rounds.slice(3).flatMap((round) => round.choices.map((choice) => choice.id)),
    );
    expect(laterChoiceIds.has("trumpet")).toBe(true);
    expect(laterChoiceIds.has("guitar")).toBe(true);
    expect(laterChoiceIds.has("wood-block")).toBe(true);
  });
});
