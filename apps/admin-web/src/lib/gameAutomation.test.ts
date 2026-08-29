import { contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import {
  createApprovedGameDraft,
  createBktGameDraftSet,
  getApprovedAutomationTemplatesForAge,
  getApprovedDifficultyOptions,
} from "./gameAutomation";

const games = contentVersionSchema.parse(contentJson).games ?? [];

describe("game automation policy", () => {
  it("keeps only schema-approved difficulty options available for every template", () => {
    for (const game of games.filter((candidate) => candidate.status === "published")) {
      expect(getApprovedDifficultyOptions(game)).toEqual(
        game.mechanic === "momo_workshop" ? ["starter"] : ["starter", "growing", "advanced"],
      );
    }
  });

  it("clones only an approved existing mechanic and bounded difficulty", () => {
    const draft = createApprovedGameDraft(games, {
      id: "automation-fish-starter-001",
      ageBand: "2-4",
      mechanic: "fish_patterns",
      difficulty: "starter",
    });
    expect(draft).toMatchObject({
      status: "draft",
      productionSource: "automation",
      mechanic: "fish_patterns",
      ageBand: "2-4",
      difficulty: { level: "starter" },
    });
  });

  it("rejects combinations without an approved template", () => {
    expect(() =>
      createApprovedGameDraft([], {
        id: "unsafe-001",
        ageBand: "4-7",
        mechanic: "fish_patterns",
        difficulty: "advanced",
      }),
    ).toThrow("onaylı bir şablon yok");
  });

  it("offers every safely adaptable published template for ages 4-7", () => {
    const publishedTemplates = games.filter((candidate) => candidate.status === "published");
    const templates = getApprovedAutomationTemplatesForAge(games, "4-7");

    expect(templates.map((template) => template.id)).toEqual(
      publishedTemplates.map((template) => template.id),
    );
  });

  it("creates a 4-7 draft from an approved 2-4 template", () => {
    const draft = createApprovedGameDraft(games, {
      id: "automation-piko-growing-4-7",
      ageBand: "4-7",
      mechanic: "mini_challenge",
      difficulty: "growing",
      templateId: "piko-pattern-train-001",
    });

    expect(draft).toMatchObject({
      ageBand: "4-7",
      mechanic: "mini_challenge",
      difficulty: { level: "growing" },
    });
  });

  it("creates an approved 4-7 draft from every offered template", () => {
    const templates = getApprovedAutomationTemplatesForAge(games, "4-7");

    for (const template of templates) {
      const difficulty = getApprovedDifficultyOptions(template).includes("growing")
        ? "growing"
        : "starter";
      const draft = createApprovedGameDraft(games, {
        id: `automation-4-7-${template.id}`,
        ageBand: "4-7",
        mechanic: template.mechanic,
        difficulty,
        templateId: template.id,
      });
      expect(draft.ageBand).toBe("4-7");
      expect(draft.difficulty.level).toBe(difficulty);
    }
  });

  it("does not create unsupported Momo age or difficulty variants", () => {
    expect(() =>
      createApprovedGameDraft(games, {
        id: "automation-momo-growing",
        ageBand: "4-7",
        mechanic: "momo_workshop",
        difficulty: "growing",
        templateId: "momo-wake-up-001",
      }),
    ).toThrow("yalnızca 4–7 yaş ve başlangıç");
  });

  it.each([
    ["piko-pattern-train-001", "Piko’nun Desen Treni"],
    ["mavi-shadow-pairs-001", "Mavi’nin Gölge Eşleri"],
    ["lumi-sound-hunt-001", "Lumi’nin Ses Avı"],
    ["toko-little-map-001", "Toko’nun Minik Haritası"],
  ])("creates the selected mini-game template %s", (templateId, expectedTitle) => {
    const draft = createApprovedGameDraft(games, {
      id: `automation-${templateId}`,
      ageBand: "2-4",
      mechanic: "mini_challenge",
      difficulty: "starter",
      templateId,
    });

    expect(draft.title).toBe(`${expectedTitle} · yeni taslak`);
    expect(draft.mechanic).toBe("mini_challenge");
  });

  it("does not silently replace an unknown selected template", () => {
    expect(() =>
      createApprovedGameDraft(games, {
        id: "automation-unknown-mini-game",
        ageBand: "2-4",
        mechanic: "mini_challenge",
        difficulty: "starter",
        templateId: "missing-template",
      }),
    ).toThrow("onaylı bir şablon yok");
  });

  it.each([
    ["starter", 12000, true],
    ["growing", 9500, true],
    ["advanced", 7000, false],
  ] as const)(
    "creates a meaningful %s difficulty variant for a selected mini game",
    (difficulty, inactivityHintMs, secondTryEnabled) => {
      const draft = createApprovedGameDraft(games, {
        id: `automation-piko-${difficulty}`,
        ageBand: "2-4",
        mechanic: "mini_challenge",
        difficulty,
        templateId: "piko-pattern-train-001",
      });

      expect(draft.mechanic).toBe("mini_challenge");
      if (draft.mechanic === "mini_challenge") {
        expect(draft.difficulty).toMatchObject({
          level: difficulty,
          inactivityHintMs,
          secondTryEnabled,
        });
      }
    },
  );

  it("creates an advanced balloon variant", () => {
    const draft = createApprovedGameDraft(games, {
      id: "automation-balloon-advanced",
      ageBand: "4-7",
      mechanic: "balloon_counting",
      difficulty: "advanced",
      templateId: "pofi-balloon-counting-001",
    });

    expect(draft).toMatchObject({
      ageBand: "4-7",
      mechanic: "balloon_counting",
      difficulty: { level: "advanced" },
    });
  });

  it("creates the selected growing Bobi memory game without changing templates", () => {
    const draft = createApprovedGameDraft(games, {
      id: "automation-bobi-growing",
      ageBand: "4-7",
      mechanic: "fish_patterns",
      difficulty: "growing",
      templateId: "bobi-fish-memory-4-7-001",
    });

    expect(draft.mechanic).toBe("fish_patterns");
    expect(draft.title).toBe("Bobi'nin Balık Hafızası · yeni taslak");
    if (draft.mechanic === "fish_patterns") {
      expect(draft.difficulty.level).toBe("growing");
      expect(
        draft.rounds.every((round) => round.kind !== "sequence_memory" || round.revealMs === 1100),
      ).toBe(true);
    }
  });

  it.each([
    ["starter", 5],
    ["growing", 8],
    ["advanced", 12],
  ] as const)("builds %s Tomo drafts with %i progressive rounds", (difficulty, roundCount) => {
    const draft = createApprovedGameDraft(games, {
      id: `automation-tomo-${difficulty}-001`,
      ageBand: "2-4",
      mechanic: "sequence_and_place",
      difficulty,
    });

    expect(draft.mechanic).toBe("sequence_and_place");
    if (draft.mechanic === "sequence_and_place") {
      expect(draft.rounds).toHaveLength(roundCount);
      expect(draft.rounds.slice(0, 5).map((round) => round.items.length)).toEqual([2, 3, 4, 5, 5]);
      expect(draft.rounds.slice(5).every((round) => round.items.length === 5)).toBe(true);
    }
  });

  it("creates a complete BKT level set without putting BKT in child-facing titles", () => {
    const drafts = createBktGameDraftSet(games, {
      ageBand: "2-4",
      ids: {
        starter: "automation-tomo-bkt-starter",
        growing: "automation-tomo-bkt-growing",
        advanced: "automation-tomo-bkt-advanced",
      },
    });

    expect(drafts.map((draft) => draft.difficulty.level)).toEqual([
      "starter",
      "growing",
      "advanced",
    ]);
    expect(
      drafts.map((draft) => (draft.mechanic === "sequence_and_place" ? draft.rounds.length : 0)),
    ).toEqual([5, 8, 12]);
    expect(drafts.every((draft) => !draft.title.includes("BKT"))).toBe(true);
    expect(
      drafts.every(
        (draft) => draft.mechanic === "sequence_and_place" && draft.leveling?.strategy === "bkt",
      ),
    ).toBe(true);
  });
});
