import { contentVersionSchema, type Game } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import {
  adaptGameComplexity,
  adaptiveGridDimensions,
  continuesAfterMaximumLevel,
  createInitialAdaptiveState,
  findGameVariant,
  itemCountForLevel,
  MAX_ADAPTIVE_ITEM_COUNT,
  MAX_ADAPTIVE_LEVEL,
  maxAdaptiveLevelForGame,
  nextDifficultyAfterCompletion,
  previousProgression,
  requiredRunsForGame,
  requiredRunsToAdvance,
  shouldAnnounceGameIntro,
} from "./adaptiveGameProgression";

const rhythmGame = {
  mechanic: "mini_challenge",
  status: "published",
  rounds: [
    {
      id: "rhythm",
      kind: "rhythm",
      prompt: "Dinle",
      choices: [
        { id: "clap", label: "Alkış", icon: "clap" },
        { id: "bell", label: "Zil", icon: "bell" },
        { id: "drum", label: "Davul", icon: "drum" },
      ],
      correctSequence: ["clap"],
      demoSequence: ["clap"],
    },
  ],
} as unknown as Game;

const publishedGames = (contentVersionSchema.parse(contentV1).games ?? []).filter(
  (game) => game.status === "published",
);

describe("adaptive game progression", () => {
  it("advances 2-4 year olds more slowly", () => {
    expect(requiredRunsToAdvance("2-4")).toBe(2);
    expect(
      nextDifficultyAfterCompletion(
        {
          difficulty: "starter",
          completedRunsAtLevel: 0,
          itemCount: 2,
          challengeIndex: 0,
          adaptiveLevel: 1,
        },
        "2-4",
      ),
    ).toEqual({
      difficulty: "starter",
      completedRunsAtLevel: 1,
      itemCount: 2,
      challengeIndex: 1,
      adaptiveLevel: 1,
    });
    expect(
      nextDifficultyAfterCompletion(
        {
          difficulty: "starter",
          completedRunsAtLevel: 1,
          itemCount: 2,
          challengeIndex: 1,
          adaptiveLevel: 1,
        },
        "2-4",
      ),
    ).toEqual({
      difficulty: "starter",
      completedRunsAtLevel: 0,
      itemCount: 2,
      challengeIndex: 2,
      adaptiveLevel: 2,
    });
  });

  it("advances 4-7 year olds after one completed run", () => {
    expect(
      nextDifficultyAfterCompletion(
        {
          difficulty: "starter",
          completedRunsAtLevel: 0,
          itemCount: 2,
          challengeIndex: 0,
          adaptiveLevel: 1,
        },
        "4-7",
      ),
    ).toEqual({
      difficulty: "starter",
      completedRunsAtLevel: 0,
      itemCount: 2,
      challengeIndex: 1,
      adaptiveLevel: 2,
    });
  });

  it("finishes Riko's distinct spatial prompts without repeating each one", () => {
    const riko = publishedGames.find((game) => game.id === "riko-where-001");
    if (!riko) throw new Error("Expected Riko game");

    expect(maxAdaptiveLevelForGame(riko)).toBe(9);
    const requiredRuns = requiredRunsForGame(riko, "2-4");
    expect(requiredRuns).toBe(1);

    let progress = createInitialAdaptiveState(riko);
    for (let step = 0; step < 9; step += 1) {
      progress = nextDifficultyAfterCompletion(
        progress,
        "2-4",
        maxAdaptiveLevelForGame(riko),
        requiredRuns,
      );
    }
    expect(progress).toMatchObject({ adaptiveLevel: 9, completedRunsAtLevel: 0 });
  });

  it("drops exactly one adaptive level after difficulty", () => {
    expect(
      previousProgression({
        difficulty: "growing",
        completedRunsAtLevel: 0,
        itemCount: 11,
        challengeIndex: 8,
        adaptiveLevel: 55,
      }),
    ).toMatchObject({ adaptiveLevel: 54, challengeIndex: 9 });
  });

  it("uses 150 levels while keeping at most 25 visible items", () => {
    expect(itemCountForLevel(MAX_ADAPTIVE_LEVEL)).toBe(MAX_ADAPTIVE_ITEM_COUNT);
  });

  it("treats 150 as a ceiling and finishes finite games earlier", () => {
    const limits = publishedGames.map((game) => maxAdaptiveLevelForGame(game));
    expect(limits.every((limit) => limit >= 1 && limit <= MAX_ADAPTIVE_LEVEL)).toBe(true);
    expect(limits.some((limit) => limit < MAX_ADAPTIVE_LEVEL)).toBe(true);
  });

  it("restores every published game from the child's saved adaptive session", () => {
    for (const game of publishedGames) {
      const maximumLevel = maxAdaptiveLevelForGame(game);
      const savedLevel = Math.min(73, maximumLevel);
      expect(
        createInitialAdaptiveState(game, {
          adaptiveLevel: savedLevel,
          challengeIndex: 41,
          completedRunsAtLevel: 1,
        }),
        game.id,
      ).toMatchObject({
        adaptiveLevel: savedLevel,
        challengeIndex: 41,
        completedRunsAtLevel: 1,
        itemCount: itemCountForLevel(savedLevel),
      });
    }
  });

  it("announces welcome narration only on the first adaptive run", () => {
    expect(shouldAnnounceGameIntro(0)).toBe(true);
    for (let runKey = 1; runKey <= MAX_ADAPTIVE_LEVEL; runKey += 1) {
      expect(shouldAnnounceGameIntro(runKey)).toBe(false);
    }
  });

  it("keeps Momo playable after mastery while finite games may complete", () => {
    const momo = publishedGames.find((game) => game.mechanic === "momo_workshop");
    const finite = publishedGames.find((game) => game.mechanic !== "momo_workshop");
    if (!momo || !finite) throw new Error("Expected Momo and a finite game");
    expect(continuesAfterMaximumLevel(momo)).toBe(true);
    expect(continuesAfterMaximumLevel(finite)).toBe(false);
  });

  it("keeps the shared adaptive layout inside a five by five grid", () => {
    for (let itemCount = 1; itemCount <= MAX_ADAPTIVE_ITEM_COUNT; itemCount += 1) {
      const grid = adaptiveGridDimensions(itemCount);
      expect(grid.columns).toBeLessThanOrEqual(5);
      expect(grid.rows).toBeLessThanOrEqual(5);
      expect(grid.columns * grid.rows).toBeGreaterThanOrEqual(itemCount);
    }
  });

  it("states the number of Pati objects that are actually shown", () => {
    const pati = publishedGames.find((game) => game.id === "rule-changed-garden-001");
    if (!pati || pati.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    const adapted = adaptGameComplexity(pati, 2, 2);
    if (adapted.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    expect(adapted.rounds[0]?.objects).toHaveLength(2);
    expect(adapted.rounds[0]?.instruction).toContain("Şimdi iki nesne var.");

    const finalRound = adaptGameComplexity(pati, 2, 3);
    if (finalRound.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");
    expect(finalRound.rounds[0]?.objects).toHaveLength(2);
    expect(finalRound.rounds[0]?.instruction).toContain("Yeşil olanı");
    expect(pati.rounds.every((round) => round.dimension !== "size")).toBe(true);
  });

  it("uses Pati's clearly colored source asset as the color-rule target", () => {
    const pati = publishedGames.find((game) => game.id === "rule-changed-garden-001");
    if (!pati || pati.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    const adapted = adaptGameComplexity(pati, 2, 8);
    if (adapted.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");
    const target = adapted.rounds[0]?.objects.find((object) =>
      object.id.endsWith("-adaptive-target"),
    );

    expect(target?.id).toBe("red-balloon-adaptive-target");
  });

  it("audits every level of every published game for bounded adaptive content", () => {
    for (const game of publishedGames) {
      const maximumLevel = maxAdaptiveLevelForGame(game);
      for (let level = 1; level <= maximumLevel; level += 1) {
        const itemCount = itemCountForLevel(level);
        const adapted = adaptGameComplexity(game, itemCount, level - 1);
        expect(adapted.id, `${game.id} level ${level}`).toBe(game.id);
        expect(itemCount, `${game.id} level ${level}`).toBeLessThanOrEqual(25);
        expect(
          adaptiveGridDimensions(itemCount).rows,
          `${game.id} level ${level}`,
        ).toBeLessThanOrEqual(5);
        switch (adapted.mechanic) {
          case "tap_or_wait": {
            const ruleIds = new Set(adapted.rules.map((rule) => rule.id));
            expect(adapted.roundPlan.rounds, `${game.id} level ${level}`).toHaveLength(itemCount);
            adapted.roundPlan.rounds.forEach((round, index) => {
              expect(ruleIds.has(round.ruleId), `${game.id} level ${level}`).toBe(true);
              if (index > 0) {
                expect(round.ruleId, `${game.id} level ${level}`).not.toBe(
                  adapted.roundPlan.rounds[index - 1]?.ruleId,
                );
              }
            });
            break;
          }
          case "classify_and_sort": {
            const round = adapted.rounds[0];
            expect(round?.objects.length, `${game.id} level ${level}`).toBeLessThanOrEqual(
              itemCount,
            );
            expect(
              round?.objects.filter((object) => object[round.dimension] === round.targetValue),
              `${game.id} level ${level}`,
            ).toHaveLength(1);
            break;
          }
          case "sequence_and_place": {
            const round = adapted.rounds[0];
            expect(new Set(round?.items.map((item) => item.id)).size).toBe(itemCount);
            expect(round?.correctOrder).toEqual(round?.items.map((item) => item.id));
            break;
          }
          case "emotion_clues":
            expect(adapted.rounds).toHaveLength(1);
            break;
          case "fish_patterns": {
            const round = adapted.rounds[0];
            if (round?.kind === "color_prediction") {
              expect(round.choices).toContain(round.correctColor);
              expect(round.correctColor).toBe(
                round.choices[round.sequence.length % round.choices.length],
              );
            } else if (round?.kind === "sequence_memory") {
              round.sequence.forEach((color) => expect(round.fish).toContain(color));
            }
            break;
          }
          case "balloon_counting": {
            const round = adapted.rounds[0];
            expect(round?.targetCount).toBeLessThanOrEqual(round?.balloons.length ?? 0);
            if (round?.kind === "color") expect(round.balloons).toContain(round.targetColor);
            if (round?.kind === "order") {
              round.targetOrder?.forEach((color) => expect(round.balloons).toContain(color));
            }
            break;
          }
          case "mini_challenge": {
            const round = adapted.rounds[0];
            const choiceIds = new Set(round?.choices.map((choice) => choice.id));
            round?.correctSequence.forEach((answer) => expect(choiceIds.has(answer)).toBe(true));
            break;
          }
          case "momo_workshop": {
            const [cables, crystals, pattern] = adapted.rounds;
            const sidesByKey = new Map<string, Set<string>>();
            cables.endpoints.forEach((endpoint) => {
              const sides = sidesByKey.get(endpoint.matchKey) ?? new Set<string>();
              sides.add(endpoint.side);
              sidesByKey.set(endpoint.matchKey, sides);
            });
            sidesByKey.forEach((sides) => expect(sides).toEqual(new Set(["left", "right"])));
            expect(crystals.targetCount).toBeLessThanOrEqual(crystals.crystalCount);
            expect(pattern.choices).toContain(pattern.correctShape);
            expect(pattern.sequence.length + 1).toBeLessThanOrEqual(25);
            const sourcePattern = game.mechanic === "momo_workshop" ? game.rounds[2] : undefined;
            const patternCycle = sourcePattern
              ? Array.from(new Set([...sourcePattern.sequence, sourcePattern.correctShape]))
              : [];
            const lastShape = pattern.sequence.at(-1);
            const lastIndex = lastShape ? patternCycle.indexOf(lastShape) : -1;
            expect(pattern.correctShape).toBe(patternCycle[(lastIndex + 1) % patternCycle.length]);
            break;
          }
        }
      }
    }
  });

  it("keeps consecutive Momo adaptive targets different through all 150 levels", () => {
    const game = publishedGames.find((candidate) => candidate.mechanic === "momo_workshop");
    if (!game || game.mechanic !== "momo_workshop") {
      throw new Error("Expected the Momo workshop game");
    }

    let previousCrystalTarget: number | undefined;
    let previousPatternTarget: string | undefined;
    for (let level = 1; level <= MAX_ADAPTIVE_LEVEL; level += 1) {
      const adapted = adaptGameComplexity(game, itemCountForLevel(level), level - 1);
      if (adapted.mechanic !== "momo_workshop") throw new Error("Expected Momo workshop");
      const [, crystals, pattern] = adapted.rounds;
      expect(crystals.targetCount, `crystal level ${level}`).not.toBe(previousCrystalTarget);
      expect(pattern.correctShape, `pattern level ${level}`).not.toBe(previousPatternTarget);
      previousCrystalTarget = crystals.targetCount;
      previousPatternTarget = pattern.correctShape;
    }
  });

  it("generates rhythm sequences from two items up to the shared limit", () => {
    const first = adaptGameComplexity(rhythmGame, 2, 0);
    const next = adaptGameComplexity(rhythmGame, 3, 2);
    const capped = adaptGameComplexity(rhythmGame, 99, 5);
    if (
      first.mechanic !== "mini_challenge" ||
      next.mechanic !== "mini_challenge" ||
      capped.mechanic !== "mini_challenge"
    ) {
      throw new Error("Expected mini challenge games");
    }
    expect(first.rounds[0]?.correctSequence).toEqual(["drum", "tambourine"]);
    expect(first.rounds[0]?.choices).toHaveLength(4);
    expect(next.rounds[0]?.correctSequence).toEqual(["tambourine", "xylophone", "triangle"]);
    expect(next.rounds[0]?.choices).toHaveLength(4);
    expect(capped.rounds[0]?.correctSequence).toHaveLength(4);
    expect(capped.rounds[0]?.choices).toHaveLength(4);
  });

  it("does not repeat the same rhythm combination on consecutive challenges", () => {
    const first = adaptGameComplexity(rhythmGame, 2, 0);
    const second = adaptGameComplexity(rhythmGame, 2, 1);
    if (first.mechanic !== "mini_challenge" || second.mechanic !== "mini_challenge") {
      throw new Error("Expected mini challenge games");
    }
    expect(first.rounds[0]?.correctSequence).not.toEqual(second.rounds[0]?.correctSequence);
  });

  it("keeps Riko's simple spatial choices stable and extends them with new scenes", () => {
    const riko = publishedGames.find((game) => game.id === "riko-where-001");
    if (!riko || riko.mechanic !== "mini_challenge") throw new Error("Expected Riko game");

    const positionIds = riko.rounds.map((round) => round.correctSequence[0]);
    expect(positionIds).toEqual(["inside", "under", "on", "left", "right"]);
    const extendedPositionIds = Array.from({ length: 9 }, (_, challengeIndex) => {
      const adapted = adaptGameComplexity(riko, 2, challengeIndex);
      if (adapted.mechanic !== "mini_challenge") throw new Error("Expected Riko mini challenge");
      return adapted.rounds[0]?.correctSequence[0];
    });
    expect(extendedPositionIds).toEqual([
      "inside",
      "under",
      "on",
      "left",
      "right",
      "behind",
      "front",
      "near",
      "far",
    ]);

    const first = adaptGameComplexity(riko, 2, 3);
    const next = adaptGameComplexity(riko, 2, 4);
    if (first.mechanic !== "mini_challenge" || next.mechanic !== "mini_challenge") {
      throw new Error("Expected Riko mini challenge");
    }
    expect(first.rounds[0]?.choices.map((choice) => choice.id)).toEqual(["left", "right"]);
    expect(next.rounds[0]?.choices.map((choice) => choice.id)).toEqual(["left", "right"]);
  });

  it("does not treat a different mini challenge as a difficulty variant", () => {
    const otherMiniGame = {
      ...rhythmGame,
      id: "maya-morning-order-001",
      title: "Maya’nın Sabah Sırası",
      difficulty: { level: "starter" },
    } as Game;
    const selectedGame = {
      ...rhythmGame,
      id: "nino-sound-rhythm-001",
      title: "Nino’nun Sesli Ritmi",
      difficulty: { level: "starter" },
    } as Game;

    expect(findGameVariant([otherMiniGame], selectedGame, "starter")).toBeUndefined();
    expect(findGameVariant([otherMiniGame, selectedGame], selectedGame, "starter")?.id).toBe(
      "nino-sound-rhythm-001",
    );
  });

  it("generates an adaptive challenge for every published game", () => {
    for (const game of publishedGames) {
      const first = adaptGameComplexity(game, 2, 0);
      const next = adaptGameComplexity(game, 2, 1);
      expect(next, game.id).not.toEqual(first);
    }
  });

  it("scales every item-based mechanic to the shared 25 item ceiling", () => {
    for (const game of publishedGames) {
      const adapted = adaptGameComplexity(game, MAX_ADAPTIVE_ITEM_COUNT, 149);
      switch (adapted.mechanic) {
        case "tap_or_wait":
          expect(adapted.roundPlan.rounds, adapted.id).toHaveLength(MAX_ADAPTIVE_ITEM_COUNT);
          break;
        case "classify_and_sort":
          expect(adapted.rounds[0]?.objects.length, adapted.id).toBeLessThanOrEqual(
            MAX_ADAPTIVE_ITEM_COUNT,
          );
          break;
        case "sequence_and_place":
          expect(adapted.rounds[0]?.items, adapted.id).toHaveLength(MAX_ADAPTIVE_ITEM_COUNT);
          break;
        case "fish_patterns": {
          const round = adapted.rounds[0];
          expect(round?.sequence.length, adapted.id).toBeLessThanOrEqual(MAX_ADAPTIVE_ITEM_COUNT);
          if (round?.kind === "color_prediction") {
            expect(round.sequence.length + 1, adapted.id).toBeLessThanOrEqual(
              MAX_ADAPTIVE_ITEM_COUNT,
            );
          }
          break;
        }
        case "balloon_counting":
          expect(adapted.rounds[0]?.balloons, adapted.id).toHaveLength(MAX_ADAPTIVE_ITEM_COUNT);
          break;
        case "mini_challenge": {
          const round = adapted.rounds[0];
          if (round?.kind === "rhythm") {
            expect(round.correctSequence, adapted.id).toHaveLength(4);
            expect(round.choices, adapted.id).toHaveLength(4);
          } else if (round?.kind !== "single") {
            expect(round?.correctSequence, adapted.id).toHaveLength(MAX_ADAPTIVE_ITEM_COUNT);
          }
          break;
        }
        case "momo_workshop":
          expect(adapted.rounds[0].endpoints.length, adapted.id).toBeLessThanOrEqual(24);
          expect(adapted.rounds[1].crystalCount, adapted.id).toBe(MAX_ADAPTIVE_ITEM_COUNT);
          expect(adapted.rounds[2].sequence.length + 1, adapted.id).toBe(MAX_ADAPTIVE_ITEM_COUNT);
          break;
        case "emotion_clues":
          expect(adapted.rounds, adapted.id).toHaveLength(1);
          break;
      }
    }
  });

  it("uses Pati's visual pool without duplicating an object in a round", () => {
    const game = publishedGames.find((candidate) => candidate.id === "rule-changed-garden-001");
    if (!game || game.mechanic !== "classify_and_sort") {
      throw new Error("Expected Pati game");
    }

    const visibleAcrossRounds = new Set<string>();
    for (let challengeIndex = 0; challengeIndex < game.rounds.length; challengeIndex += 1) {
      const adapted = adaptGameComplexity(game, MAX_ADAPTIVE_ITEM_COUNT, challengeIndex);
      if (adapted.mechanic !== "classify_and_sort") {
        throw new Error("Expected adapted Pati game");
      }
      const objectIds = adapted.rounds[0]?.objects.map((object) => object.id) ?? [];
      const baseIds = objectIds.map((id) => id.replace(/-adaptive-(target|distractor)$/, ""));
      expect(new Set(baseIds).size).toBe(baseIds.length);
      baseIds.forEach((id) => visibleAcrossRounds.add(id));
    }
    expect(visibleAcrossRounds).toContain("cat");
    expect(visibleAcrossRounds).toContain("picnic-basket");
  });

  it("keeps every generated balloon instruction consistent with visible balloons", () => {
    const game = publishedGames.find((candidate) => candidate.mechanic === "balloon_counting");
    if (!game || game.mechanic !== "balloon_counting") {
      throw new Error("Expected the balloon counting game");
    }

    for (let challengeIndex = 0; challengeIndex < 30; challengeIndex += 1) {
      const itemCount = itemCountForLevel(challengeIndex + 1);
      const adapted = adaptGameComplexity(game, itemCount, challengeIndex);
      if (adapted.mechanic !== "balloon_counting") throw new Error("Expected balloon game");
      const round = adapted.rounds[0];
      expect(round?.balloons, round?.id).toHaveLength(itemCount);
      expect(round?.targetCount, round?.id).toBeLessThanOrEqual(round?.balloons.length ?? 0);
      if (round?.kind === "color") {
        expect(round.targetColor, round.id).toBeDefined();
        expect(round.balloons, round.id).toContain(round.targetColor);
      }
      if (round?.kind === "order") {
        expect(round.targetOrder, round.id).toHaveLength(itemCount);
        for (const color of round.targetOrder ?? []) {
          expect(round.balloons, round.id).toContain(color);
        }
      }
    }
  });
});
