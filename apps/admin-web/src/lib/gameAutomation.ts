import {
  type AgeBand,
  type Game,
  type GameDifficultyLevel,
  type GameMechanic,
  gameSchema,
} from "@adaptive/content-schema";

export const AUTOMATION_POLICY_VERSION = "game-automation-policy-v1" as const;

export interface GameAutomationRequest {
  id: string;
  ageBand: AgeBand;
  mechanic: GameMechanic;
  difficulty: GameDifficultyLevel;
  templateId?: string;
}

export interface BktLevelSetRequest {
  ageBand: AgeBand;
  ids: Record<GameDifficultyLevel, string>;
}

export function getApprovedDifficultyOptions(game: Game): GameDifficultyLevel[] {
  return ["starter", "growing", "advanced"];
}

export function getApprovedAutomationTemplatesForAge(templates: Game[], ageBand: AgeBand): Game[] {
  return templates.filter((candidate) => {
    if (candidate.status !== "published") return false;
    if (candidate.mechanic !== "fish_patterns" || candidate.ageBand === ageBand) return true;
    return templates.some(
      (targetTemplate) =>
        targetTemplate.status === "published" &&
        targetTemplate.mechanic === "fish_patterns" &&
        targetTemplate.ageBand === ageBand,
    );
  });
}

export function createApprovedGameDraft(templates: Game[], request: GameAutomationRequest): Game {
  const selectedTemplate = request.templateId
    ? templates.find(
        (candidate) =>
          candidate.id === request.templateId &&
          candidate.status === "published" &&
          candidate.mechanic === request.mechanic,
      )
    : undefined;
  const exactTemplate = request.templateId
    ? selectedTemplate
    : templates.find(
        (candidate) =>
          candidate.status === "published" &&
          candidate.ageBand === request.ageBand &&
          candidate.mechanic === request.mechanic &&
          candidate.difficulty.level === request.difficulty,
      );
  const transferableDifficultyTemplate = request.templateId
    ? undefined
    : templates.find(
        (candidate) =>
          candidate.status === "published" &&
          candidate.mechanic === request.mechanic &&
          candidate.difficulty.level === request.difficulty,
      );
  const routineTemplate =
    request.mechanic === "sequence_and_place" && !request.templateId
      ? templates.find(
          (candidate) =>
            candidate.status === "published" &&
            candidate.mechanic === "sequence_and_place" &&
            candidate.leveling?.strategy === "bkt",
        )
      : undefined;
  const template =
    selectedTemplate ?? exactTemplate ?? transferableDifficultyTemplate ?? routineTemplate;
  if (!template) {
    throw new Error("Seçilen yaş, oyun şablonu ve zorluk için onaylı bir şablon yok.");
  }

  const draft = {
    ...structuredClone(template),
    id: request.id,
    version: 1,
    status: "draft",
    ageBand: request.ageBand,
    productionSource: "automation",
    title: `${template.title} · yeni taslak`,
  } as Game;

  draft.difficulty.level = request.difficulty;

  if (draft.mechanic === "fish_patterns") {
    const expectedRoundKind = request.ageBand === "2-4" ? "color_prediction" : "sequence_memory";
    if (draft.rounds.some((round) => round.kind !== expectedRoundKind)) {
      const targetAgeTemplate = templates.find(
        (candidate) =>
          candidate.status === "published" &&
          candidate.mechanic === "fish_patterns" &&
          candidate.ageBand === request.ageBand &&
          candidate.rounds.every((round) => round.kind === expectedRoundKind),
      );
      if (!targetAgeTemplate || targetAgeTemplate.mechanic !== "fish_patterns") {
        throw new Error("Balık oyunu için hedef yaşa uygun onaylı tur şablonu yok.");
      }
      draft.rounds = structuredClone(targetAgeTemplate.rounds);
    }
  }

  if (draft.mechanic === "sequence_and_place") {
    const targetRoundCount = { starter: 5, growing: 8, advanced: 12 }[request.difficulty];
    draft.difficulty.level = request.difficulty;
    draft.rounds = Array.from({ length: targetRoundCount }, (_, index) => {
      const sourceRound = draft.rounds[Math.min(index, draft.rounds.length - 1)];
      if (!sourceRound) throw new Error("Onaylı rutin şablonunda tur bulunamadı.");
      return {
        ...structuredClone(sourceRound),
        id: `${sourceRound.id}-${index + 1}`,
      };
    });
    draft.difficulty.secondTryEnabled = request.difficulty !== "advanced";
    draft.difficulty.hintDelayMs = { starter: 12000, growing: 9000, advanced: 7000 }[
      request.difficulty
    ];
  } else if (draft.mechanic === "tap_or_wait") {
    draft.difficulty.interRoundDelayMs = { starter: 1800, growing: 1200, advanced: 700 }[
      request.difficulty
    ];
    draft.difficulty.reminderMode =
      request.difficulty === "starter" ? "every_round" : "when_needed";
    draft.difficulty.ruleChangeEnabled =
      draft.ageBand === "4-7" && request.difficulty === "advanced";
  } else if (draft.mechanic === "classify_and_sort") {
    draft.difficulty.secondTryEnabled = request.difficulty !== "advanced";
    draft.difficulty.responseWindowMs = { starter: 25000, growing: 18000, advanced: 12000 }[
      request.difficulty
    ];
  } else if (draft.mechanic === "emotion_clues") {
    draft.difficulty.secondTryEnabled = request.difficulty !== "advanced";
    draft.difficulty.askClueQuestion = request.difficulty !== "starter";
  } else if (draft.mechanic === "fish_patterns") {
    draft.difficulty.secondTryEnabled = request.difficulty !== "advanced";
    draft.rounds = draft.rounds.map((round) =>
      round.kind === "sequence_memory"
        ? {
            ...round,
            revealMs: { starter: 1600, growing: 1100, advanced: 700 }[request.difficulty],
          }
        : round,
    );
  } else if (draft.mechanic === "balloon_counting") {
    draft.difficulty.secondTryEnabled = request.difficulty === "starter";
  } else if (draft.mechanic === "mini_challenge") {
    draft.difficulty.secondTryEnabled = request.difficulty !== "advanced";
    draft.difficulty.inactivityHintMs = { starter: 12000, growing: 9500, advanced: 7000 }[
      request.difficulty
    ];
  }

  return gameSchema.parse(draft);
}

export function createBktGameDraftSet(templates: Game[], request: BktLevelSetRequest): Game[] {
  const template = templates.find(
    (candidate) =>
      candidate.status === "published" &&
      candidate.mechanic === "sequence_and_place" &&
      candidate.leveling?.strategy === "bkt",
  );
  if (!template) {
    throw new Error("Bu yaş grubu için onaylı bir BKT rutin şablonu yok.");
  }

  const labels: Record<GameDifficultyLevel, string> = {
    starter: "Başlangıç",
    growing: "Gelişen",
    advanced: "İleri",
  };

  return (["starter", "growing", "advanced"] as const).map((difficulty) => {
    const draft = createApprovedGameDraft(templates, {
      id: request.ids[difficulty],
      ageBand: request.ageBand,
      mechanic: "sequence_and_place",
      difficulty,
    });
    return gameSchema.parse({
      ...draft,
      title: `${template.title} · ${labels[difficulty]}`,
    });
  });
}
