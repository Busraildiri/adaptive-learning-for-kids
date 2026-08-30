import type { AgeBand } from "@adaptive/shared-types";
import { z } from "zod";

export const CONTENT_SCHEMA_VERSION = "0.2.0" as const;

export const ageBandSchema = z.enum(["2-4", "4-7"]) satisfies z.ZodType<AgeBand>;

export const activityTypeSchema = z.enum([
  "instruction",
  "guided_practice",
  "independent_practice",
  "transfer",
]);

export const emotionIdSchema = z.enum(["happy", "sad", "angry", "scared"]);
export const assetEmotionSchema = z.enum(["happy", "sad", "angry", "scared", "neutral"]);

export const assetTypeSchema = z.enum(["image", "audio", "animation", "video", "symbol"]);

export const assetSemanticSchema = z.strictObject({
  character: z.string().trim().min(1),
  object: z.string().trim().min(1),
  eventState: z.string().trim().min(1),
  emotion: assetEmotionSchema,
  allowedNarrativeTerms: z.array(z.string().trim().min(1)).min(1),
  prohibitedNarrativeTerms: z.array(z.string().trim().min(1)),
  reviewStatus: z.enum(["pending", "approved"]),
  rightsStatus: z.enum(["needs_confirmation", "cleared"]),
  provenance: z.strictObject({
    source: z.enum(["gemini-apps", "owned", "licensed"]),
    aiGenerated: z.boolean(),
    generatedByUser: z.boolean(),
    thirdPartyReferencesDeclared: z.boolean(),
    disclosure: z.string().trim().min(1),
  }),
});

export const assetPresentationSchema = z.strictObject({
  aspectRatio: z.number().positive(),
  fit: z.enum(["cover", "contain"]),
  focalPoint: z.strictObject({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
});

export const assetSchema = z.strictObject({
  id: z.string().trim().min(1),
  type: assetTypeSchema,
  uri: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  accessibilityLabel: z.string().trim().min(1).optional(),
  semantic: assetSemanticSchema.optional(),
  presentation: assetPresentationSchema.optional(),
});

export const supportiveFeedbackSchema = z.strictObject({
  narration: z.string().trim().min(1),
  audioAssetId: z.string().trim().min(1).optional(),
  followUpPrompt: z.string().trim().min(1).optional(),
});

export const storyResolutionSchema = z.strictObject({
  narration: z.string().trim().min(1),
  audioAssetId: z.string().trim().min(1).optional(),
});

export const choiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  emotion: emotionIdSchema,
  assetId: z.string().trim().min(1),
  supportiveFeedback: supportiveFeedbackSchema,
});

export const helpActionSchema = z.enum([
  "hug",
  "new_balloon",
  "pet_head",
  "say_love",
  "give_gift",
  "breathe",
]);

export const storyChoiceVisualSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("balloon"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
]);

export const storyChoiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  accessibilityLabel: z.string().trim().min(1),
  visual: storyChoiceVisualSchema,
  acknowledgement: z.string().trim().min(1),
});

export const storyEmotionChoiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  emotion: emotionIdSchema,
  accessibilityLabel: z.string().trim().min(1),
  supportiveFeedback: supportiveFeedbackSchema,
});

export const storyHelpChoiceSchema = z.strictObject({
  id: z.string().trim().min(1),
  action: helpActionSchema,
  accessibilityLabel: z.string().trim().min(1),
  resultNarration: z.string().trim().min(1),
});

export const storyStepSchema = z.discriminatedUnion("type", [
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("choice"),
    prompt: z.string().trim().min(1),
    choices: z.tuple([storyChoiceSchema, storyChoiceSchema], storyChoiceSchema),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("tap"),
    prompt: z.string().trim().min(1),
    requiredTaps: z.number().int().min(1).max(5),
    completionNarration: z.string().trim().min(1),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("event"),
    narration: z.string().trim().min(1),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("emotion_choice"),
    prompt: z.string().trim().min(1),
    choices: z.tuple(
      [storyEmotionChoiceSchema, storyEmotionChoiceSchema],
      storyEmotionChoiceSchema,
    ),
    storyResolution: storyResolutionSchema,
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("help_choice"),
    prompt: z.string().trim().min(1),
    choices: z.tuple([storyHelpChoiceSchema, storyHelpChoiceSchema], storyHelpChoiceSchema),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("breathing"),
    narration: z.string().trim().min(1),
    cycles: z.number().int().min(1).max(3),
  }),
  z.strictObject({
    id: z.string().trim().min(1),
    type: z.literal("closing"),
    narration: z.string().trim().min(1),
  }),
]);

// Durable product contract, not UI-filtering metadata: which playback
// experience a Story was authored/generated for.
//   interactive_ui  -> MinoStory (existing mobile interactive UI)
//   video_branching -> the new StoryPlayer (Phase 1-5 pipeline)
// Defaulting to "interactive_ui" is a safe, additive default for every
// existing story -- that is genuinely what they are. experienceType alone
// is a declared intent, not a compatibility guarantee: a video_branching
// Story must still separately pass structural validation (exactly one
// decision-capable step, exactly two choices) before it can reach Scene
// Planning -- see apps/admin-web's validateVideoBranchingCompatibility.
export const experienceTypeSchema = z.enum(["interactive_ui", "video_branching"]);

export const storySchema = z.strictObject({
  id: z.string().trim().min(1),
  version: z.number().int().positive(),
  title: z.string().trim().min(1),
  ageBands: z.tuple([ageBandSchema], ageBandSchema),
  targetSkills: z.array(z.string().trim().min(1)).min(1),
  greetingTemplate: z.string().trim().min(1),
  experienceType: experienceTypeSchema.default("interactive_ui"),
  sceneAssetId: z.string().trim().min(1).optional(),
  introVideoAssetId: z.string().trim().min(1).optional(),
  characterAssets: z.strictObject({
    happyAssetId: z.string().trim().min(1),
    sadAssetId: z.string().trim().min(1),
    angryAssetId: z.string().trim().min(1).optional(),
  }),
  flowAssetIds: z.array(z.string().trim().min(1)).min(1).max(4).optional(),
  steps: z.array(storyStepSchema).min(1),
});

export const contentStatusSchema = z.enum(["draft", "in_review", "published", "archived"]);

export const gameProductionSourceSchema = z.enum(["manual", "ai", "automation"]);
export const GAME_DIFFICULTY_SCHEMA_VERSION = "game-difficulty-v1" as const;
export const gameDifficultyLevelSchema = z.enum(["starter", "growing", "advanced"]);
export const gameMechanicSchema = z.enum([
  "tap_or_wait",
  "classify_and_sort",
  "sequence_and_place",
  "emotion_clues",
  "fish_patterns",
  "balloon_counting",
  "mini_challenge",
  "momo_workshop",
]);
export const gameReminderModeSchema = z.enum(["every_round", "when_needed"]);

export const gameExpectedActionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("tap_count"),
    count: z.number().int().min(1).max(2),
    responseWindowMs: z.number().int().min(3_000).max(10_000),
  }),
  z.strictObject({
    type: z.literal("wait_without_tap"),
    durationMs: z.number().int().min(3_000).max(8_000),
  }),
]);

export const gameRuleSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  stimulus: z.strictObject({
    kind: z.literal("signal"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    symbol: z.string().trim().min(1).max(4),
    accessibilityLabel: z.string().trim().min(1).max(120),
  }),
  expectedAction: gameExpectedActionSchema,
  instruction: z.string().trim().min(1).max(160),
  reminder: z.string().trim().min(1).max(120),
});

export const tapOrWaitGameSchema = z
  .strictObject({
    schemaVersion: z.literal("game-v1"),
    difficultyVersion: z
      .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
      .default(GAME_DIFFICULTY_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(100),
    version: z.number().int().positive(),
    status: contentStatusSchema,
    productionSource: gameProductionSourceSchema,
    mechanic: z.literal("tap_or_wait"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240),
    ageBand: ageBandSchema,
    skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
    presentation: z.strictObject({
      mascotAssetId: z.string().trim().min(1).optional(),
      introNarration: z.string().trim().min(1).max(240),
      closingNarration: z.string().trim().min(1).max(200),
      showRuleReminder: z.boolean(),
      playAudioInstructions: z.boolean(),
    }),
    rules: z.array(gameRuleSchema).min(2).max(3),
    roundPlan: z.strictObject({
      mode: z.literal("manual"),
      rounds: z
        .array(z.strictObject({ ruleId: z.string().trim().min(1).max(100) }))
        .min(3)
        .max(10),
    }),
    feedback: z.strictObject({
      expectedActionMatched: z.string().trim().min(1).max(120),
      tapWhileWaiting: z.string().trim().min(1).max(160),
      tooFewTaps: z.string().trim().min(1).max(120),
      tooManyTaps: z.string().trim().min(1).max(120),
      noResponse: z.string().trim().min(1).max(120),
      roundTransition: z.string().trim().min(1).max(120),
    }),
    difficulty: z.strictObject({
      level: gameDifficultyLevelSchema,
      interRoundDelayMs: z.number().int().min(500).max(3_000),
      reminderMode: gameReminderModeSchema,
      ruleChangeEnabled: z.boolean(),
    }),
    adaptation: z.strictObject({
      enabled: z.boolean(),
      minimumRoundCount: z.number().int().min(3).max(10),
      maximumRoundCount: z.number().int().min(3).max(10),
      minimumResponseWindowMs: z.number().int().min(3_000).max(10_000),
      maximumResponseWindowMs: z.number().int().min(3_000).max(10_000),
      allowedReminderModes: z.array(gameReminderModeSchema).min(1),
    }),
  })
  .superRefine((game, context) => {
    const ruleIds = new Set(game.rules.map((rule) => rule.id));
    if (ruleIds.size !== game.rules.length) {
      context.addIssue({ code: "custom", path: ["rules"], message: "Rule ids must be unique." });
    }
    game.roundPlan.rounds.forEach((round, index) => {
      if (!ruleIds.has(round.ruleId)) {
        context.addIssue({
          code: "custom",
          path: ["roundPlan", "rounds", index, "ruleId"],
          message: "Round must reference an existing rule.",
        });
      }
    });
    if (game.adaptation.minimumRoundCount > game.adaptation.maximumRoundCount) {
      context.addIssue({
        code: "custom",
        path: ["adaptation", "minimumRoundCount"],
        message: "Minimum round count cannot exceed maximum round count.",
      });
    }
    if (game.adaptation.minimumResponseWindowMs > game.adaptation.maximumResponseWindowMs) {
      context.addIssue({
        code: "custom",
        path: ["adaptation", "minimumResponseWindowMs"],
        message: "Minimum response window cannot exceed maximum response window.",
      });
    }
    if (game.ageBand === "2-4") {
      if (game.rules.length > 2) {
        context.addIssue({
          code: "custom",
          path: ["rules"],
          message: "Games for ages 2-4 can use at most two rules.",
        });
      }
      if (game.roundPlan.rounds.length > 6) {
        context.addIssue({
          code: "custom",
          path: ["roundPlan", "rounds"],
          message: "Games for ages 2-4 can use at most six rounds.",
        });
      }
      if (game.difficulty.ruleChangeEnabled) {
        context.addIssue({
          code: "custom",
          path: ["difficulty", "ruleChangeEnabled"],
          message: "Rule changes are not supported for ages 2-4.",
        });
      }
    }
  });

export const sortObjectSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  shape: z.enum(["ball", "car", "bear", "fish", "block", "star"]),
  color: z.enum(["red", "blue", "yellow", "green", "purple"]),
  category: z.enum(["toy", "animal"]),
  size: z.enum(["small", "large"]),
});

export const sortRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  dimension: z.enum(["color", "category", "size"]),
  targetValue: z.string().trim().min(1).max(40),
  instruction: z.string().trim().min(1).max(160),
  objects: z.array(sortObjectSchema).min(3).max(6),
});

export const classifyAndSortGameSchema = z
  .strictObject({
    schemaVersion: z.literal("game-v1"),
    difficultyVersion: z
      .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
      .default(GAME_DIFFICULTY_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(100),
    version: z.number().int().positive(),
    status: contentStatusSchema,
    productionSource: gameProductionSourceSchema,
    mechanic: z.literal("classify_and_sort"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240),
    ageBand: ageBandSchema,
    skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
    presentation: z.strictObject({
      mascotAssetId: z.string().trim().min(1).optional(),
      introNarration: z.string().trim().min(1).max(240),
      closingNarration: z.string().trim().min(1).max(200),
      ruleChangeNarration: z.string().trim().min(1).max(120),
      playAudioInstructions: z.boolean(),
    }),
    rounds: z.array(sortRoundSchema).min(2).max(5),
    feedback: z.strictObject({
      matched: z.string().trim().min(1).max(120),
      retry: z.string().trim().min(1).max(160),
      transition: z.string().trim().min(1).max(120),
    }),
    difficulty: z.strictObject({
      level: gameDifficultyLevelSchema,
      secondTryEnabled: z.boolean(),
      responseWindowMs: z.number().int().min(4_000).max(30_000),
    }),
  })
  .superRefine((game, context) => {
    game.rounds.forEach((round, roundIndex) => {
      const objectIds = new Set(round.objects.map((object) => object.id));
      if (objectIds.size !== round.objects.length) {
        context.addIssue({
          code: "custom",
          path: ["rounds", roundIndex, "objects"],
          message: "Object ids must be unique in each round.",
        });
      }
      const matchingCount = round.objects.filter(
        (object) => object[round.dimension] === round.targetValue,
      ).length;
      if (matchingCount !== 1) {
        context.addIssue({
          code: "custom",
          path: ["rounds", roundIndex, "targetValue"],
          message: "Starter rounds must contain exactly one matching object.",
        });
      }
    });
    if (game.ageBand === "2-4" && game.rounds.some((round) => round.objects.length > 4)) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "Games for ages 2-4 can show at most four objects per round.",
      });
    }
  });

export const routineItemSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  assetKey: z.enum([
    "blocks",
    "toy-basket",
    "toothbrush",
    "storybook",
    "pajamas",
    "bed",
    "wash-hands",
    "towel",
    "coat",
    "shoes",
  ]),
});

export const routineRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  instruction: z.string().trim().min(1).max(180),
  items: z.array(routineItemSchema).min(2).max(5),
  correctOrder: z.array(z.string().trim().min(1).max(100)).min(2).max(5),
});

const probabilitySchema = z.number().min(0).max(1);

export const bktLevelingSchema = z
  .strictObject({
    strategy: z.literal("bkt"),
    modelVersion: z.literal("bkt-v1"),
    skillId: z.string().trim().min(1).max(100),
    parameters: z.strictObject({
      initialMastery: probabilitySchema,
      learningRate: probabilitySchema,
      guessRate: probabilitySchema,
      slipRate: probabilitySchema,
    }),
    thresholds: z.strictObject({
      growing: z.strictObject({
        minimumMastery: probabilitySchema,
        minimumObservations: z.number().int().min(2).max(50),
      }),
      advanced: z.strictObject({
        minimumMastery: probabilitySchema,
        minimumObservations: z.number().int().min(3).max(100),
      }),
    }),
  })
  .superRefine((leveling, context) => {
    if (leveling.parameters.guessRate + leveling.parameters.slipRate >= 1) {
      context.addIssue({
        code: "custom",
        path: ["parameters"],
        message: "BKT guess and slip rates must add up to less than one.",
      });
    }
    if (leveling.thresholds.growing.minimumMastery >= leveling.thresholds.advanced.minimumMastery) {
      context.addIssue({
        code: "custom",
        path: ["thresholds", "advanced", "minimumMastery"],
        message: "Advanced BKT mastery must be greater than growing mastery.",
      });
    }
    if (
      leveling.thresholds.growing.minimumObservations >=
      leveling.thresholds.advanced.minimumObservations
    ) {
      context.addIssue({
        code: "custom",
        path: ["thresholds", "advanced", "minimumObservations"],
        message: "Advanced BKT evidence must exceed growing evidence.",
      });
    }
  });

export const sequenceAndPlaceGameSchema = z
  .strictObject({
    schemaVersion: z.literal("game-v1"),
    difficultyVersion: z
      .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
      .default(GAME_DIFFICULTY_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(100),
    version: z.number().int().positive(),
    status: contentStatusSchema,
    productionSource: gameProductionSourceSchema,
    mechanic: z.literal("sequence_and_place"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240),
    ageBand: ageBandSchema,
    skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
    presentation: z.strictObject({
      mascotAssetId: z.string().trim().min(1).optional(),
      introNarration: z.string().trim().min(1).max(240),
      closingNarration: z.string().trim().min(1).max(200),
      playAudioInstructions: z.boolean(),
    }),
    rounds: z.array(routineRoundSchema).min(5).max(12),
    feedback: z.strictObject({
      matched: z.string().trim().min(1).max(120),
      retry: z.string().trim().min(1).max(160),
      hint: z.string().trim().min(1).max(160),
    }),
    difficulty: z.strictObject({
      level: gameDifficultyLevelSchema,
      secondTryEnabled: z.boolean(),
      hintDelayMs: z.number().int().min(5_000).max(30_000),
    }),
    leveling: bktLevelingSchema.optional(),
  })
  .superRefine((game, context) => {
    const requiredRoundCount = {
      starter: 5,
      growing: 8,
      advanced: 12,
    }[game.difficulty.level];

    if (game.rounds.length !== requiredRoundCount) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: `${game.difficulty.level} routine games must contain ${requiredRoundCount} rounds.`,
      });
    }

    game.rounds.forEach((round, roundIndex) => {
      const requiredItemCount = Math.min(roundIndex + 2, 5);
      if (round.items.length !== requiredItemCount) {
        context.addIssue({
          code: "custom",
          path: ["rounds", roundIndex, "items"],
          message: `Routine round ${roundIndex + 1} must contain ${requiredItemCount} items.`,
        });
      }
      const itemIds = round.items.map((item) => item.id);
      if (new Set(itemIds).size !== itemIds.length) {
        context.addIssue({
          code: "custom",
          path: ["rounds", roundIndex, "items"],
          message: "Routine item ids must be unique.",
        });
      }
      if (
        round.correctOrder.length !== itemIds.length ||
        new Set(round.correctOrder).size !== itemIds.length ||
        round.correctOrder.some((itemId) => !itemIds.includes(itemId))
      ) {
        context.addIssue({
          code: "custom",
          path: ["rounds", roundIndex, "correctOrder"],
          message: "Correct order must contain every routine item exactly once.",
        });
      }
    });
  });

export const emotionClueRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  sceneAssetKey: z.enum(["sad-bear", "happy-rabbit", "angry-fox"]),
  storyPrompt: z.string().trim().min(1).max(180),
  emotionPrompt: z.string().trim().min(1).max(140),
  correctEmotion: z.enum(["happy", "sad", "angry", "scared"]),
  cluePrompt: z.string().trim().min(1).max(160),
  correctClue: z.enum(["mouth", "eyes", "body"]),
});

export const emotionCluesGameSchema = z.strictObject({
  schemaVersion: z.literal("game-v1"),
  difficultyVersion: z
    .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
    .default(GAME_DIFFICULTY_SCHEMA_VERSION),
  id: z.string().trim().min(1).max(100),
  version: z.number().int().positive(),
  status: contentStatusSchema,
  productionSource: gameProductionSourceSchema,
  mechanic: z.literal("emotion_clues"),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(240),
  ageBand: ageBandSchema,
  skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
  presentation: z.strictObject({
    mascotAssetId: z.string().trim().min(1).optional(),
    introNarration: z.string().trim().min(1).max(240),
    closingNarration: z.string().trim().min(1).max(200),
    playAudioInstructions: z.boolean(),
  }),
  rounds: z.array(emotionClueRoundSchema).min(2).max(5),
  feedback: z.strictObject({
    emotionMatched: z.string().trim().min(1).max(120),
    clueMatched: z.string().trim().min(1).max(120),
    retry: z.string().trim().min(1).max(160),
  }),
  difficulty: z.strictObject({
    level: gameDifficultyLevelSchema,
    secondTryEnabled: z.boolean(),
    askClueQuestion: z.boolean(),
  }),
});

const fishColorSchema = z.enum([
  "red",
  "blue",
  "yellow",
  "teal",
  "green",
  "purple",
  "pink",
  "orange",
]);

const fishColorPatternRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  kind: z.literal("color_prediction"),
  sequence: z.array(fishColorSchema).min(3).max(4),
  correctColor: fishColorSchema,
  choices: z.array(fishColorSchema).min(2).max(3),
  prompt: z.string().trim().min(1).max(160),
});

const fishMemoryRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  kind: z.literal("sequence_memory"),
  fish: z.array(fishColorSchema).min(2).max(4),
  sequence: z.array(fishColorSchema).min(2).max(4),
  prompt: z.string().trim().min(1).max(160),
  revealMs: z.number().int().min(500).max(1800),
});

export const fishPatternsGameSchema = z
  .strictObject({
    schemaVersion: z.literal("game-v1"),
    difficultyVersion: z
      .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
      .default(GAME_DIFFICULTY_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(100),
    version: z.number().int().positive(),
    status: contentStatusSchema,
    productionSource: gameProductionSourceSchema,
    mechanic: z.literal("fish_patterns"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240),
    ageBand: ageBandSchema,
    skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
    presentation: z.strictObject({
      introNarration: z.string().trim().min(1).max(240),
      closingNarration: z.string().trim().min(1).max(200),
      playAudioInstructions: z.boolean(),
    }),
    rounds: z
      .array(z.discriminatedUnion("kind", [fishColorPatternRoundSchema, fishMemoryRoundSchema]))
      .min(2)
      .max(5),
    feedback: z.strictObject({
      matched: z.string().trim().min(1).max(120),
      retry: z.string().trim().min(1).max(160),
    }),
    difficulty: z.strictObject({
      level: gameDifficultyLevelSchema,
      secondTryEnabled: z.boolean(),
    }),
  })
  .superRefine((game, context) => {
    const expectedKind = game.ageBand === "2-4" ? "color_prediction" : "sequence_memory";
    game.rounds.forEach((round, index) => {
      if (round.kind !== expectedKind)
        context.addIssue({
          code: "custom",
          path: ["rounds", index, "kind"],
          message: `Age band ${game.ageBand} requires ${expectedKind} rounds.`,
        });
      if (round.kind === "color_prediction" && !round.choices.includes(round.correctColor))
        context.addIssue({
          code: "custom",
          path: ["rounds", index, "choices"],
          message: "Choices must include the correct color.",
        });
      if (
        round.kind === "sequence_memory" &&
        round.sequence.some((color) => !round.fish.includes(color))
      )
        context.addIssue({
          code: "custom",
          path: ["rounds", index, "sequence"],
          message: "Memory sequence must use visible fish.",
        });
    });
  });

const balloonColorSchema = z.enum([
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
  "cyan",
]);
const balloonRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  kind: z.enum(["count", "color", "order"]),
  prompt: z.string().trim().min(1).max(160),
  balloons: z.array(balloonColorSchema).min(2).max(5),
  targetCount: z.number().int().min(1).max(3),
  targetColor: balloonColorSchema.optional(),
  targetOrder: z.array(balloonColorSchema).max(2).optional(),
});

export const balloonCountingGameSchema = z
  .strictObject({
    schemaVersion: z.literal("game-v1"),
    difficultyVersion: z
      .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
      .default(GAME_DIFFICULTY_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(100),
    version: z.number().int().positive(),
    status: contentStatusSchema,
    productionSource: gameProductionSourceSchema,
    mechanic: z.literal("balloon_counting"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240),
    ageBand: ageBandSchema,
    skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
    presentation: z.strictObject({
      introNarration: z.string().trim().min(1).max(240),
      closingNarration: z.string().trim().min(1).max(200),
      playAudioInstructions: z.boolean(),
    }),
    rounds: z.array(balloonRoundSchema).min(3).max(5),
    feedback: z.strictObject({
      matched: z.string().trim().min(1).max(120),
      retry: z.string().trim().min(1).max(160),
    }),
    difficulty: z.strictObject({
      level: gameDifficultyLevelSchema,
      secondTryEnabled: z.boolean(),
      inactivityHintMs: z.literal(10000),
    }),
  })
  .superRefine((game, context) =>
    game.rounds.forEach((round, index) => {
      if (
        round.kind === "color" &&
        (!round.targetColor || !round.balloons.includes(round.targetColor))
      )
        context.addIssue({
          code: "custom",
          path: ["rounds", index, "targetColor"],
          message: "Color round requires a visible target color.",
        });
      if (
        round.kind === "order" &&
        (!round.targetOrder ||
          round.targetOrder.length !== 2 ||
          round.targetOrder.some((color) => !round.balloons.includes(color)))
      )
        context.addIssue({
          code: "custom",
          path: ["rounds", index, "targetOrder"],
          message: "Order round requires two visible colors.",
        });
      if (round.kind === "count" && round.targetCount > round.balloons.length)
        context.addIssue({
          code: "custom",
          path: ["rounds", index, "targetCount"],
          message: "Target count cannot exceed balloon count.",
        });
    }),
  );

const miniIconSchema = z.enum([
  "clap",
  "bell",
  "drum",
  "toothbrush",
  "shirt",
  "breakfast",
  "box",
  "ball",
  "chair",
  "circle",
  "square",
  "triangle",
  "star",
  "small-bear",
  "large-bear",
  "maya-brush",
  "maya-shirt",
  "maya-breakfast",
  "riko-inside",
  "riko-under",
  "riko-on",
  "riko-left",
  "riko-right",
  "zuzu-circle",
  "zuzu-square",
  "zuzu-triangle",
  "zuzu-star",
  "kiki-small-apple",
  "kiki-large-apple",
  "kiki-small-acorn",
  "kiki-large-acorn",
  "piko-red-circle",
  "piko-blue-square",
  "piko-yellow-triangle",
  "mavi-cat",
  "mavi-car",
  "mavi-tree",
  "mavi-boat",
  "lumi-cat",
  "lumi-dog",
  "lumi-car",
  "lumi-rain",
  "lumi-bird",
  "direction-left",
  "direction-right",
  "direction-up",
  "direction-down",
]);

const miniChoiceSchema = z.strictObject({
  id: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(60),
  icon: miniIconSchema,
  rotationDegrees: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .optional(),
  silhouette: z.boolean().optional(),
});
const miniRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  kind: z.enum(["rhythm", "sequence", "single"]),
  prompt: z.string().trim().min(1).max(180),
  choices: z.array(miniChoiceSchema).min(2).max(4),
  correctSequence: z.array(z.string().trim().min(1)).min(1).max(3),
  demoSequence: z.array(z.string().trim().min(1)).max(3).optional(),
  displaySequence: z.array(miniIconSchema).min(2).max(6).optional(),
  previewIcon: miniIconSchema.optional(),
  soundCue: z.string().trim().min(1).max(80).optional(),
});
export const miniChallengeGameSchema = z.strictObject({
  schemaVersion: z.literal("game-v1"),
  difficultyVersion: z
    .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
    .default(GAME_DIFFICULTY_SCHEMA_VERSION),
  id: z.string().trim().min(1).max(100),
  version: z.number().int().positive(),
  status: contentStatusSchema,
  productionSource: gameProductionSourceSchema,
  mechanic: z.literal("mini_challenge"),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(240),
  ageBand: ageBandSchema,
  skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
  presentation: z.strictObject({
    introNarration: z.string().trim().min(1).max(240),
    closingNarration: z.string().trim().min(1).max(200),
    playAudioInstructions: z.boolean(),
  }),
  rounds: z.array(miniRoundSchema).min(2).max(5),
  feedback: z.strictObject({
    matched: z.string().trim().min(1).max(120),
    retry: z.string().trim().min(1).max(160),
  }),
  difficulty: z.strictObject({
    level: gameDifficultyLevelSchema.default("starter"),
    secondTryEnabled: z.boolean(),
    inactivityHintMs: z.number().int().min(7000).max(15000),
  }),
});

export const momoCableColorSchema = z.enum(["coral", "blue", "yellow", "green", "purple"]);
export const momoShapeSchema = z.enum(["circle", "square", "triangle"]);
export const momoPartVisualSchema = z.enum(["star-antenna", "spring-antenna"]);

export const momoCableEndpointSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  color: momoCableColorSchema,
  matchKey: z.string().trim().min(1).max(40),
  side: z.enum(["left", "right"]),
});

export const momoCableRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  kind: z.literal("cable_match"),
  prompt: z.string().trim().min(1).max(160),
  endpoints: z.array(momoCableEndpointSchema).min(4).max(6),
});

export const momoCrystalRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  kind: z.literal("crystal_count"),
  prompt: z.string().trim().min(1).max(160),
  crystalCount: z.number().int().min(2).max(5),
  targetCount: z.number().int().min(1).max(5),
});

export const momoPatternRoundSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  kind: z.literal("pattern_shape"),
  prompt: z.string().trim().min(1).max(160),
  sequence: z.array(momoShapeSchema).min(3).max(6),
  choices: z.array(momoShapeSchema).min(2).max(3),
  correctShape: momoShapeSchema,
});

export const momoWorkshopRoundSchema = z.discriminatedUnion("kind", [
  momoCableRoundSchema,
  momoCrystalRoundSchema,
  momoPatternRoundSchema,
]);

export const momoRewardChoiceSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  visual: momoPartVisualSchema,
});

export const momoWorkshopGameSchema = z
  .strictObject({
    schemaVersion: z.literal("game-v1"),
    difficultyVersion: z
      .literal(GAME_DIFFICULTY_SCHEMA_VERSION)
      .default(GAME_DIFFICULTY_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(100),
    version: z.number().int().positive(),
    status: contentStatusSchema,
    productionSource: gameProductionSourceSchema,
    mechanic: z.literal("momo_workshop"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240),
    ageBand: ageBandSchema,
    skillTags: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
    presentation: z.strictObject({
      introNarration: z.string().trim().min(1).max(240),
      rewardNarration: z.string().trim().min(1).max(180),
      closingNarration: z.string().trim().min(1).max(200),
      playAudioInstructions: z.boolean(),
    }),
    rounds: z.tuple([momoCableRoundSchema, momoCrystalRoundSchema, momoPatternRoundSchema]),
    rewardChoices: z.tuple([momoRewardChoiceSchema, momoRewardChoiceSchema]),
    feedback: z.strictObject({
      matched: z.string().trim().min(1).max(120),
      retry: z.string().trim().min(1).max(160),
      reveal: z.string().trim().min(1).max(160),
    }),
    difficulty: z.strictObject({
      level: gameDifficultyLevelSchema,
      secondTryEnabled: z.boolean(),
      inactivityHintMs: z.number().int().min(7_000).max(15_000),
    }),
  })
  .superRefine((game, context) => {
    if (game.ageBand !== "4-7") {
      context.addIssue({
        code: "custom",
        path: ["ageBand"],
        message: "The Momo workshop prototype belongs to the 4-7 age band.",
      });
    }
    if (game.difficulty.level !== "starter") {
      context.addIssue({
        code: "custom",
        path: ["difficulty", "level"],
        message: "The first Momo workshop prototype must use starter difficulty.",
      });
    }

    const endpointIds = new Set(game.rounds[0].endpoints.map((endpoint) => endpoint.id));
    if (endpointIds.size !== game.rounds[0].endpoints.length) {
      context.addIssue({
        code: "custom",
        path: ["rounds", 0, "endpoints"],
        message: "Cable endpoint ids must be unique.",
      });
    }
    const endpointsByMatch = new Map<string, { left: number; right: number }>();
    for (const endpoint of game.rounds[0].endpoints) {
      const counts = endpointsByMatch.get(endpoint.matchKey) ?? { left: 0, right: 0 };
      counts[endpoint.side] += 1;
      endpointsByMatch.set(endpoint.matchKey, counts);
    }
    if ([...endpointsByMatch.values()].some(({ left, right }) => left !== 1 || right !== 1)) {
      context.addIssue({
        code: "custom",
        path: ["rounds", 0, "endpoints"],
        message: "Every cable match must contain one left and one right endpoint.",
      });
    }
    if (game.rounds[1].targetCount > game.rounds[1].crystalCount) {
      context.addIssue({
        code: "custom",
        path: ["rounds", 1, "targetCount"],
        message: "Crystal target count cannot exceed the visible crystal count.",
      });
    }
    if (!game.rounds[2].choices.includes(game.rounds[2].correctShape)) {
      context.addIssue({
        code: "custom",
        path: ["rounds", 2, "choices"],
        message: "Pattern choices must include the correct shape.",
      });
    }
    if (new Set(game.rewardChoices.map((choice) => choice.id)).size !== 2) {
      context.addIssue({
        code: "custom",
        path: ["rewardChoices"],
        message: "Momo reward choices must be different.",
      });
    }
  });

export const gameSchema = z.discriminatedUnion("mechanic", [
  tapOrWaitGameSchema,
  classifyAndSortGameSchema,
  sequenceAndPlaceGameSchema,
  emotionCluesGameSchema,
  fishPatternsGameSchema,
  balloonCountingGameSchema,
  miniChallengeGameSchema,
  momoWorkshopGameSchema,
]);

export const activitySchema = z.strictObject({
  id: z.string().trim().min(1),
  version: z.number().int().positive(),
  ageBands: z.tuple([ageBandSchema], ageBandSchema),
  activityType: activityTypeSchema,
  targetSkill: z.string().trim().min(1),
  sceneAssetId: z.string().trim().min(1),
  narration: z.string().trim().min(1),
  narrationAudioAssetId: z.string().trim().min(1).optional(),
  choices: z.tuple([choiceSchema, choiceSchema], choiceSchema),
  storyResolution: storyResolutionSchema,
});

export const contentVersionSchema = z.strictObject({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  locale: z.literal("tr-TR"),
  status: contentStatusSchema,
  createdAt: z.iso.datetime(),
  assets: z.array(assetSchema),
  activities: z.array(activitySchema),
  stories: z.array(storySchema).min(1),
  games: z.array(gameSchema).optional(),
});
