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
  POFI_BALLOON_MAX_COUNT,
  POFI_BALLOON_MAX_LEVEL,
  pofiBalloonCountForLevel,
  previousProgression,
  previousZuzuProgression,
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

  it("does not require a repeat after a finite game's final combination", () => {
    expect(
      nextDifficultyAfterCompletion(
        {
          difficulty: "starter",
          completedRunsAtLevel: 0,
          itemCount: 2,
          challengeIndex: 9,
          adaptiveLevel: 10,
        },
        "2-4",
        10,
      ),
    ).toMatchObject({ adaptiveLevel: 10, completedRunsAtLevel: 0, challengeIndex: 10 });
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

  it("drops Zuzu by at most two levels without returning to the beginning", () => {
    expect(
      previousZuzuProgression({
        difficulty: "growing",
        completedRunsAtLevel: 0,
        itemCount: 11,
        challengeIndex: 27,
        adaptiveLevel: 28,
      }),
    ).toMatchObject({ adaptiveLevel: 26, challengeIndex: 25 });

    expect(
      previousZuzuProgression({
        difficulty: "growing",
        completedRunsAtLevel: 0,
        itemCount: 3,
        challengeIndex: 1,
        adaptiveLevel: 2,
      }),
    ).toMatchObject({ adaptiveLevel: 1, challengeIndex: 0 });
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

    expect(requiredRunsForGame(pati, "2-4")).toBe(1);

    const adapted = adaptGameComplexity(pati, 2, 2);
    if (adapted.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    expect(adapted.rounds[0]?.objects).toHaveLength(2);
    expect(adapted.rounds[0]?.instruction).toContain("Şimdi iki nesne var.");

    const shapeRound = adaptGameComplexity(pati, 2, 3);
    if (shapeRound.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");
    expect(shapeRound.rounds[0]?.objects).toHaveLength(2);
    expect(shapeRound.rounds[0]?.instruction).toContain("Yıldızı");
    expect(pati.rounds.every((round) => round.dimension !== "size")).toBe(true);
  });

  it("describes only the routine cards that Tomo shows", () => {
    const tomo = publishedGames.find((game) => game.id === "mino-routine-path-001");
    if (!tomo || tomo.mechanic !== "sequence_and_place") throw new Error("Expected Tomo game");

    expect(requiredRunsForGame(tomo, "2-4")).toBe(1);
    expect(maxAdaptiveLevelForGame(tomo)).toBe(5);
    expect(
      tomo.rounds.map((round, index) => {
        const level = adaptGameComplexity(tomo, round.items.length, index);
        return level.mechanic === "sequence_and_place" ? level.rounds[0]?.items.length : 0;
      }),
    ).toEqual([2, 3, 4, 5, 5]);

    const adapted = adaptGameComplexity(tomo, 4, 2);
    if (adapted.mechanic !== "sequence_and_place") throw new Error("Expected Tomo game");

    expect(adapted.rounds[0]?.items).toHaveLength(4);
    expect(adapted.rounds[0]?.instruction).toBe(
      "Önce diş fırçasını, sonra pijamayı, sonra hikâye kitabını, en son yatağı.",
    );
  });

  it("shows Duru's five scenes once in order and always asks for the clue", () => {
    const duru = publishedGames.find((game) => game.id === "mino-emotion-detective-001");
    if (!duru || duru.mechanic !== "emotion_clues") {
      throw new Error("Expected Duru game");
    }

    expect(requiredRunsForGame(duru, "2-4")).toBe(1);
    expect(maxAdaptiveLevelForGame(duru)).toBe(duru.rounds.length);

    const shownRoundIds = duru.rounds.map((_, index) => {
      const adapted = adaptGameComplexity(duru, 2, index);
      if (adapted.mechanic !== "emotion_clues") throw new Error("Expected Duru game");
      expect(adapted.difficulty.askClueQuestion).toBe(true);
      return adapted.rounds[0]?.id.replace(/-adaptive-\d+$/, "");
    });

    expect(shownRoundIds).toEqual(duru.rounds.map((round) => round.id));
  });

  it("uses Pati's clearly colored source asset as the color-rule target", () => {
    const pati = publishedGames.find((game) => game.id === "rule-changed-garden-001");
    if (!pati || pati.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    const adapted = adaptGameComplexity(pati, 2, 5);
    if (adapted.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");
    const target = adapted.rounds[0]?.objects.find((object) =>
      object.id.endsWith("-adaptive-target"),
    );

    expect(target?.id).toBe("red-balloon-adaptive-target");
  });

  it("uses Pati's visible animal target instead of a generic category label", () => {
    const pati = publishedGames.find((game) => game.id === "rule-changed-garden-001");
    if (!pati || pati.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    const adapted = adaptGameComplexity(pati, 2, 1);
    if (adapted.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");
    expect(adapted.rounds[0]?.instruction).toBe("Köpeği sepete sürükle ve bırak.");
  });

  it("rotates Pati's rules rather than returning to the same color on adjacent levels", () => {
    const pati = publishedGames.find((game) => game.id === "rule-changed-garden-001");
    if (!pati || pati.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    const instructions = Array.from({ length: 5 }, (_, index) => {
      const adapted = adaptGameComplexity(pati, 12, index);
      if (adapted.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");
      return adapted.rounds[0]?.instruction;
    });

    expect(instructions).toEqual([
      "Kırmızı olanı sepete sürükle ve bırak.",
      "Köpeği sepete sürükle ve bırak.",
      "Şimdi 12 nesne var. Mavi olanı sepete sürükle ve bırak.",
      "Yıldızı sepete sürükle ve bırak.",
      "Mor arabayı sepete sürükle ve bırak.",
    ]);
  });

  it("does not select an unverified Pati animal visual as a target", () => {
    const pati = publishedGames.find((game) => game.id === "rule-changed-garden-001");
    if (!pati || pati.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");

    for (let challengeIndex = 0; challengeIndex < 80; challengeIndex += 1) {
      const adapted = adaptGameComplexity(pati, 12, challengeIndex);
      if (adapted.mechanic !== "classify_and_sort") throw new Error("Expected Pati game");
      expect(adapted.rounds[0]?.instruction).not.toMatch(/kedi|tavşan|tilki|ayıcık/);
    }
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
          expect(adapted.rounds[0]?.balloons, adapted.id).toHaveLength(
            adapted.id === "pofi-balloon-counting-001"
              ? POFI_BALLOON_MAX_COUNT
              : MAX_ADAPTIVE_ITEM_COUNT,
          );
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

    for (let challengeIndex = 0; challengeIndex < POFI_BALLOON_MAX_LEVEL; challengeIndex += 1) {
      const itemCount = pofiBalloonCountForLevel(challengeIndex + 1);
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
        expect(round.targetOrder, round.id).toHaveLength(round.targetCount);
        for (const color of round.targetOrder ?? []) {
          expect(round.balloons, round.id).toContain(color);
        }
      }
    }
  });

  it("builds 150 unique Pofi levels and increases the balloon count up to twelve", () => {
    const game = publishedGames.find((candidate) => candidate.id === "pofi-balloon-counting-001");
    if (!game || game.mechanic !== "balloon_counting") throw new Error("Expected Pofi game");

    expect(requiredRunsForGame(game, "2-4")).toBe(1);
    expect(maxAdaptiveLevelForGame(game)).toBe(POFI_BALLOON_MAX_LEVEL);
    expect(pofiBalloonCountForLevel(1)).toBe(2);
    expect(pofiBalloonCountForLevel(2)).toBe(3);
    expect(pofiBalloonCountForLevel(4)).toBe(5);
    expect(pofiBalloonCountForLevel(11)).toBe(12);
    expect(pofiBalloonCountForLevel(POFI_BALLOON_MAX_LEVEL)).toBe(12);

    const signatures = new Set<string>();
    const counts: number[] = [];
    const kinds = new Set<string>();
    for (let level = 1; level <= POFI_BALLOON_MAX_LEVEL; level += 1) {
      const itemCount = pofiBalloonCountForLevel(level);
      const adapted = adaptGameComplexity(game, itemCount, level - 1);
      if (adapted.mechanic !== "balloon_counting") throw new Error("Expected Pofi game");
      const round = adapted.rounds[0];
      if (!round) throw new Error(`Expected Pofi level ${level}`);

      counts.push(round.balloons.length);
      kinds.add(round.kind);
      signatures.add(
        JSON.stringify({
          kind: round.kind,
          balloons: round.balloons,
          targetColor: round.targetColor,
          targetCount: round.targetCount,
          targetOrder: round.targetOrder,
        }),
      );
      expect(round.id).toContain(`level-${level}`);
      expect(new Set(round.balloons).size).toBe(round.balloons.length);
    }

    expect(signatures.size).toBe(POFI_BALLOON_MAX_LEVEL);
    expect(kinds).toEqual(new Set(["count", "color", "order"]));
    expect(counts.every((count, index) => index === 0 || count >= (counts[index - 1] ?? 0))).toBe(
      true,
    );

    const openingLevels = Array.from({ length: 4 }, (_, index) => {
      const level = index + 1;
      const adapted = adaptGameComplexity(game, pofiBalloonCountForLevel(level), level - 1);
      if (adapted.mechanic !== "balloon_counting") throw new Error("Expected Pofi game");
      const round = adapted.rounds[0];
      return { balloonCount: round?.balloons.length, kind: round?.kind };
    });
    expect(openingLevels).toEqual([
      { balloonCount: 2, kind: "count" },
      { balloonCount: 3, kind: "color" },
      { balloonCount: 4, kind: "order" },
      { balloonCount: 5, kind: "count" },
    ]);
  });

  it("stages Zuzu from 4x4 shapes to color matching and larger boards", () => {
    const game = publishedGames.find((candidate) => candidate.id === "zuzu-missing-piece-001");
    if (!game || game.mechanic !== "mini_challenge") throw new Error("Expected Zuzu game");

    expect(maxAdaptiveLevelForGame(game)).toBe(60);
    const sizes = [0, 1, 2].map((challengeIndex) => {
      const adapted = adaptGameComplexity(game, 1, challengeIndex);
      if (adapted.mechanic !== "mini_challenge") throw new Error("Expected adapted Zuzu game");
      return adapted.rounds[0];
    });
    expect(sizes.map((round) => round?.boardSize)).toEqual([4, 4, 4]);
    expect(sizes.map((round) => round?.levelNumber)).toEqual([1, 2, 3]);
    expect(new Set(sizes.map((round) => round?.prompt)).size).toBe(3);
    expect(sizes.map((round) => round?.boardPalette)).toEqual([
      ["#65A7F3"],
      ["#65A7F3"],
      ["#65A7F3"],
    ]);

    const levelFive = adaptGameComplexity(game, 1, 4);
    const levelSix = adaptGameComplexity(game, 1, 5);
    if (levelFive.mechanic !== "mini_challenge" || levelSix.mechanic !== "mini_challenge") {
      throw new Error("Expected Zuzu levels 5 and 6");
    }
    expect(levelFive.rounds[0]?.levelNumber).toBe(5);
    expect(levelSix.rounds[0]?.levelNumber).toBe(6);
    expect(levelFive.rounds[0]?.choices).toHaveLength(3);
    expect(levelSix.rounds[0]?.choices).toHaveLength(4);
    expect(levelFive.rounds[0]?.piecePalette).toBeUndefined();
    expect(levelSix.rounds[0]?.piecePalette).toBeUndefined();

    const levelEleven = adaptGameComplexity(game, 1, 10);
    const levelTwelve = adaptGameComplexity(game, 1, 11);
    const levelFourteen = adaptGameComplexity(game, 1, 13);
    const levelFifteen = adaptGameComplexity(game, 1, 14);
    const levelSixteen = adaptGameComplexity(game, 1, 15);
    if (
      levelEleven.mechanic !== "mini_challenge" ||
      levelTwelve.mechanic !== "mini_challenge" ||
      levelFourteen.mechanic !== "mini_challenge" ||
      levelFifteen.mechanic !== "mini_challenge" ||
      levelSixteen.mechanic !== "mini_challenge"
    ) {
      throw new Error("Expected staged Zuzu color levels");
    }
    expect(levelEleven.rounds[0]).toMatchObject({ boardSize: 4, boardPalette: ["#65A7F3"] });
    expect(levelEleven.rounds[0]?.piecePalette).toBeUndefined();
    expect(levelTwelve.rounds[0]).toMatchObject({
      boardSize: 4,
      boardPalette: ["#4C87D9", "#79C9F2"],
    });
    expect(levelTwelve.rounds[0]?.piecePalette).toBeDefined();
    expect(levelFourteen.rounds[0]?.boardPalette).toHaveLength(2);
    expect(levelFourteen.rounds[0]?.piecePalette).toEqual(["#4C87D9", "#79C9F2", "#4C87D9"]);
    expect(levelFifteen.rounds[0]).toMatchObject({
      levelNumber: 15,
      boardSize: 4,
      correctSequence: ["triangle"],
      pieceOffsetColumn: 3,
      pieceOffsetRow: 0,
      boardPalette: ["#4C87D9", "#79C9F2"],
      piecePalette: ["#79C9F2", "#4C87D9", "#79C9F2"],
      holePalette: ["#79C9F2", "#4C87D9", "#79C9F2"],
    });
    const levelFifteenTriangleChoices = levelFifteen.rounds[0]?.choices.filter(
      (choice) => choice.icon === "zuzu-triangle",
    );
    expect(levelFifteenTriangleChoices).toHaveLength(2);
    expect(
      levelFifteenTriangleChoices?.find((choice) => choice.id === "triangle"),
    ).not.toHaveProperty("cellPalette");
    expect(
      levelFifteenTriangleChoices?.find((choice) => choice.id === "triangle-wrong-colors"),
    ).toMatchObject({ cellPalette: ["#4C87D9", "#79C9F2", "#79C9F2"] });

    const levelNineteen = adaptGameComplexity(game, 1, 18);
    if (levelNineteen.mechanic !== "mini_challenge") throw new Error("Expected Zuzu level 19");
    const levelNineteenTriangleChoices = levelNineteen.rounds[0]?.choices.filter(
      (choice) => choice.icon === "zuzu-triangle",
    );
    expect(levelNineteen.rounds[0]).toMatchObject({
      levelNumber: 19,
      correctSequence: ["triangle"],
      piecePalette: ["#79C9F2", "#4C87D9", "#79C9F2"],
    });
    expect(levelNineteenTriangleChoices).toHaveLength(2);
    expect(
      levelNineteenTriangleChoices?.find((choice) => choice.id === "triangle-wrong-colors"),
    ).toMatchObject({ cellPalette: ["#4C87D9", "#79C9F2", "#79C9F2"] });
    expect(levelSixteen.rounds[0]).toMatchObject({ boardSize: 4 });
    expect(levelSixteen.rounds[0]?.boardPalette).toHaveLength(2);

    const levelTwenty = adaptGameComplexity(game, 1, 19);
    if (levelTwenty.mechanic !== "mini_challenge") throw new Error("Expected Zuzu level 20");
    expect(levelTwenty.rounds[0]).toMatchObject({
      levelNumber: 20,
      levelCount: 60,
      boardSize: 4,
      choices: expect.arrayContaining([
        expect.objectContaining({ id: "square", icon: "zuzu-square" }),
      ]),
      correctSequence: ["square"],
      piecePalette: ["#79C9F2", "#72D69B", "#4C87D9"],
      holePalette: ["#79C9F2", "#72D69B", "#4C87D9"],
    });
    expect(levelTwenty.rounds[0]?.choices).toHaveLength(4);

    const levelFifty = adaptGameComplexity(game, 1, 49);
    if (levelFifty.mechanic !== "mini_challenge") throw new Error("Expected Zuzu level 50");
    expect(levelFifty.rounds[0]).toMatchObject({
      levelNumber: 50,
      levelCount: 60,
      boardSize: 8,
    });

    const levelFiftySix = adaptGameComplexity(game, 1, 55);
    if (levelFiftySix.mechanic !== "mini_challenge") throw new Error("Expected Zuzu level 56");
    expect(levelFiftySix.rounds[0]).toMatchObject({
      levelNumber: 56,
      levelCount: 60,
      boardSize: 16,
    });

    const uniqueLayouts = new Set(
      Array.from({ length: 60 }, (_, challengeIndex) => {
        const adapted = adaptGameComplexity(game, 1, challengeIndex);
        if (adapted.mechanic !== "mini_challenge") throw new Error("Expected unique Zuzu level");
        const round = adapted.rounds[0];
        return JSON.stringify({
          boardSize: round?.boardSize,
          correctSequence: round?.correctSequence,
          pieceOffsetColumn: round?.pieceOffsetColumn,
          pieceOffsetRow: round?.pieceOffsetRow,
          boardPalette: round?.boardPalette,
        });
      }),
    );
    expect(uniqueLayouts.size).toBe(60);
  });
});
