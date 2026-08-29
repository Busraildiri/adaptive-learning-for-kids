import { describe, expect, it } from "vitest";
import contentV1 from "../content/tr-TR/content.v1.json";
import { contentVersionSchema } from "./schemas";

describe("Turkish content v1", () => {
  it("registers the Mırmır red-balloon pack with locked semantic metadata", () => {
    const content = contentVersionSchema.parse(contentV1);
    const assets = content.assets.filter((asset) => asset.id.startsWith("character-mirmir-"));

    expect(assets).toHaveLength(3);
    expect(assets.map((asset) => asset.semantic?.eventState)).toEqual([
      "holding",
      "popped",
      "playing",
    ]);
    expect(assets.map((asset) => asset.semantic?.emotion)).toEqual(["happy", "sad", "happy"]);
    expect(assets.every((asset) => asset.semantic?.rightsStatus === "cleared")).toBe(true);
    expect(assets.every((asset) => asset.semantic?.provenance.source === "gemini-apps")).toBe(true);
  });
  it("contains six valid activities", () => {
    const content = contentVersionSchema.parse(contentV1);

    expect(content.activities).toHaveLength(6);
  });

  it("covers all four activity types", () => {
    const content = contentVersionSchema.parse(contentV1);
    const activityTypes = new Set(content.activities.map((activity) => activity.activityType));

    expect(activityTypes).toEqual(
      new Set(["instruction", "guided_practice", "independent_practice", "transfer"]),
    );
  });

  it("provides unique ids and supportive feedback for every choice", () => {
    const content = contentVersionSchema.parse(contentV1);
    const activityIds = content.activities.map((activity) => activity.id);

    expect(new Set(activityIds).size).toBe(activityIds.length);

    for (const activity of content.activities) {
      expect(activity.storyResolution.narration.length).toBeGreaterThan(0);

      for (const choice of activity.choices) {
        expect(choice.supportiveFeedback.narration.length).toBeGreaterThan(0);
        expect(choice).not.toHaveProperty("isCorrect");
      }
    }
  });

  it("contains five valid playable stories so the personalization gate is reachable", () => {
    const content = contentVersionSchema.parse(contentV1);
    const story = content.stories[0];
    const stepTypes = story.steps.map((step) => step.type);

    expect(content.stories).toHaveLength(5);
    expect(story.ageBands).toContain("2-4");
    expect(stepTypes.filter((type) => type === "emotion_choice")).toHaveLength(1);
    expect(new Set(stepTypes)).toEqual(
      new Set(["choice", "tap", "event", "emotion_choice", "help_choice", "breathing", "closing"]),
    );
  });

  it("uses existing scene symbols and gives every emotion its own non-judgmental feedback", () => {
    const content = contentVersionSchema.parse(contentV1);
    const expectedSceneAssets = new Set([
      "scene-block-tower",
      "scene-friend-goodbye",
      "scene-lost-toy",
    ]);
    const newStories = content.stories.filter(
      (story) => story.id !== "mino-balloon-story" && story.id.startsWith("mino-"),
    );

    expect(new Set(newStories.map((story) => story.sceneAssetId))).toEqual(expectedSceneAssets);

    for (const story of content.stories) {
      const emotionSteps = story.steps.filter((step) => step.type === "emotion_choice");
      expect(emotionSteps.length).toBeGreaterThanOrEqual(1);

      for (const step of emotionSteps) {
        for (const choice of step.choices) {
          expect(choice.supportiveFeedback.narration.length).toBeGreaterThan(0);
          expect(choice).not.toHaveProperty("isCorrect");
          expect(choice).not.toHaveProperty("correctAnswer");
        }
      }
    }
  });

  it("keeps every game long enough and increases later-round complexity", () => {
    const content = contentVersionSchema.parse(contentV1);

    for (const game of content.games ?? []) {
      const roundCount =
        game.mechanic === "tap_or_wait" ? game.roundPlan.rounds.length : game.rounds.length;
      expect(roundCount).toBeGreaterThanOrEqual(5);
    }

    const routineGame = content.games?.find((game) => game.mechanic === "sequence_and_place");
    const sortGame = content.games?.find((game) => game.mechanic === "classify_and_sort");
    const kikiGame = content.games?.find((game) => game.id === "kiki-big-small-shop-001");

    expect(routineGame?.mechanic).toBe("sequence_and_place");
    if (routineGame?.mechanic === "sequence_and_place") {
      expect(routineGame.rounds.map((round) => round.items.length)).toEqual([2, 3, 4, 5, 5]);
      expect(routineGame.leveling).toMatchObject({
        strategy: "bkt",
        modelVersion: "bkt-v1",
        skillId: "routine-ordering",
        thresholds: {
          growing: { minimumObservations: 4 },
          advanced: { minimumObservations: 8 },
        },
      });
      expect(routineGame.title).not.toContain("BKT");
    }
    expect(sortGame?.mechanic).toBe("classify_and_sort");
    if (sortGame?.mechanic === "classify_and_sort") {
      expect(sortGame.rounds.map((round) => round.objects.length)).toEqual([3, 3, 3, 4, 4]);
    }
    expect(kikiGame?.mechanic).toBe("mini_challenge");
    if (kikiGame?.mechanic === "mini_challenge") {
      expect(kikiGame.rounds.map((round) => round.choices.length)).toEqual([2, 2, 2, 3, 4]);
    }
  });

  it("starts both fish games with four visible fish", () => {
    const content = contentVersionSchema.parse(contentV1);
    const fishGames = (content.games ?? []).filter((game) => game.mechanic === "fish_patterns");

    for (const game of fishGames) {
      const firstRound = game.rounds[0];
      if (!firstRound) throw new Error("Fish game must have a first round.");
      const visibleFish =
        firstRound.kind === "color_prediction" ? firstRound.sequence : firstRound.fish;
      expect(visibleFish).toHaveLength(4);
    }
  });

  it("includes the four new progressive mini games without duplicating Zuzu", () => {
    const content = contentVersionSchema.parse(contentV1);
    const games = content.games ?? [];
    const piko = games.find((game) => game.id === "piko-pattern-train-001");
    const mavi = games.find((game) => game.id === "mavi-shadow-pairs-001");
    const lumi = games.find((game) => game.id === "lumi-sound-hunt-001");
    const toko = games.find((game) => game.id === "toko-little-map-001");

    expect(games.filter((game) => game.id === "zuzu-missing-piece-001")).toHaveLength(1);
    expect([piko, mavi, lumi, toko].every((game) => game?.mechanic === "mini_challenge")).toBe(
      true,
    );
    if (piko?.mechanic === "mini_challenge") {
      expect(piko.rounds.every((round) => (round.displaySequence?.length ?? 0) >= 3)).toBe(true);
    }
    if (mavi?.mechanic === "mini_challenge") {
      expect(mavi.rounds.every((round) => Boolean(round.previewIcon))).toBe(true);
      expect(
        mavi.rounds.some((round) => round.choices.some((choice) => choice.rotationDegrees)),
      ).toBe(true);
    }
    if (lumi?.mechanic === "mini_challenge") {
      expect(lumi.rounds.every((round) => Boolean(round.soundCue))).toBe(true);
    }
    if (toko?.mechanic === "mini_challenge") {
      expect(toko.rounds.map((round) => round.correctSequence.length)).toEqual([1, 2, 2, 3, 3]);
    }
  });
});
