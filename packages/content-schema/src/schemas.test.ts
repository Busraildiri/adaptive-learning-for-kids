import { describe, expect, it } from "vitest";
import { z } from "zod";
import generatedJsonSchema from "../generated/content-version.schema.json";
import { contentVersionSchema, tapOrWaitGameSchema } from "./schemas";

const validTapOrWaitGame = {
  schemaVersion: "game-v1",
  id: "color-lights-001",
  version: 1,
  status: "draft",
  productionSource: "manual",
  mechanic: "tap_or_wait",
  title: "Renkli Işıklar",
  description: "Yeşilde dokun, kırmızıda bekle.",
  ageBand: "2-4",
  skillTags: ["yönerge-takibi", "bekleme-pratiği"],
  presentation: {
    mascotAssetId: "character-mino-happy",
    introNarration: "Yeşil ışık görünce dokun. Kırmızı ışık görünce bekle.",
    closingNarration: "Oyun tamamlandı!",
    showRuleReminder: true,
    playAudioInstructions: true,
  },
  rules: [
    {
      id: "green-tap",
      stimulus: {
        kind: "signal",
        color: "#45B96B",
        symbol: "✓",
        accessibilityLabel: "Yeşil dokunma ışığı",
      },
      expectedAction: { type: "tap_count", count: 1, responseWindowMs: 5_000 },
      instruction: "Yeşil ışığa bir kere dokun.",
      reminder: "Yeşilde dokunuyoruz.",
    },
    {
      id: "red-wait",
      stimulus: {
        kind: "signal",
        color: "#D9534F",
        symbol: "■",
        accessibilityLabel: "Kırmızı bekleme ışığı",
      },
      expectedAction: { type: "wait_without_tap", durationMs: 4_000 },
      instruction: "Kırmızı ışıkta bekle.",
      reminder: "Bu kez bekliyoruz.",
    },
  ],
  roundPlan: {
    mode: "manual",
    rounds: [
      { ruleId: "green-tap" },
      { ruleId: "red-wait" },
      { ruleId: "green-tap" },
      { ruleId: "green-tap" },
      { ruleId: "red-wait" },
    ],
  },
  feedback: {
    expectedActionMatched: "Devam edelim!",
    tapWhileWaiting: "Bu kez bekliyoruz. Bir daha deneyelim.",
    tooFewTaps: "Bir dokunuş daha yapabilirsin.",
    tooManyTaps: "Yeni tur geliyor.",
    noResponse: "Şimdi sıradaki geliyor.",
    roundTransition: "Hazır ol, yenisi geliyor!",
  },
  difficulty: {
    level: "starter",
    interRoundDelayMs: 1_200,
    reminderMode: "every_round",
    ruleChangeEnabled: false,
  },
  adaptation: {
    enabled: true,
    minimumRoundCount: 3,
    maximumRoundCount: 6,
    minimumResponseWindowMs: 4_000,
    maximumResponseWindowMs: 8_000,
    allowedReminderModes: ["every_round", "when_needed"],
  },
} as const;

describe("tapOrWaitGameSchema", () => {
  it("accepts a bounded game for ages 2-4", () => {
    expect(tapOrWaitGameSchema.parse(validTapOrWaitGame)).toEqual(validTapOrWaitGame);
  });

  it("rejects rounds that reference missing rules", () => {
    expect(
      tapOrWaitGameSchema.safeParse({
        ...validTapOrWaitGame,
        roundPlan: {
          mode: "manual",
          rounds: [{ ruleId: "missing" }, { ruleId: "green-tap" }, { ruleId: "red-wait" }],
        },
      }).success,
    ).toBe(false);
  });

  it("enforces the rule and round limits for ages 2-4", () => {
    const thirdRule = { ...validTapOrWaitGame.rules[0], id: "another-tap" };
    expect(
      tapOrWaitGameSchema.safeParse({
        ...validTapOrWaitGame,
        rules: [...validTapOrWaitGame.rules, thirdRule],
        roundPlan: {
          mode: "manual",
          rounds: Array.from({ length: 7 }, () => ({ ruleId: "green-tap" })),
        },
      }).success,
    ).toBe(false);
  });
});

const validContent = {
  schemaVersion: "0.2.0",
  contentVersion: "1.0.0",
  locale: "tr-TR",
  status: "draft",
  createdAt: "2026-08-26T12:00:00.000Z",
  assets: [
    {
      id: "scene-lost-toy",
      type: "image",
      uri: "assets/scenes/lost-toy.png",
      mimeType: "image/png",
      accessibilityLabel: "Oyuncağı yere düşen ayıcık",
    },
    {
      id: "emotion-sad",
      type: "image",
      uri: "assets/emotions/sad.png",
      mimeType: "image/png",
      accessibilityLabel: "Üzgün yüz",
    },
    {
      id: "emotion-angry",
      type: "image",
      uri: "assets/emotions/angry.png",
      mimeType: "image/png",
      accessibilityLabel: "Kızgın yüz",
    },
  ],
  activities: [
    {
      id: "lost-toy-emotions",
      version: 1,
      ageBands: ["2-4", "4-7"],
      activityType: "guided_practice",
      targetSkill: "emotion_recognition",
      sceneAssetId: "scene-lost-toy",
      narration: "Ayıcığın oyuncağı yere düştü. Sence nasıl hissediyor?",
      choices: [
        {
          id: "sad",
          emotion: "sad",
          assetId: "emotion-sad",
          supportiveFeedback: {
            narration: "Üzgün hissetmiş olabilir. Oyuncağının düşmesi onu üzmüş olabilir.",
          },
        },
        {
          id: "angry",
          emotion: "angry",
          assetId: "emotion-angry",
          supportiveFeedback: {
            narration:
              "Kızgın hissetmiş olması da mümkün. Oyuncağının düşmesi onu kızdırmış olabilir.",
          },
        },
      ],
      storyResolution: {
        narration: "Bu hikâyede ayıcık, oyuncağı düştüğü için üzgün hissediyor.",
      },
    },
  ],
  stories: [
    {
      id: "mino-balloon-story",
      version: 1,
      title: "Mino'nun Balonu",
      ageBands: ["2-4"],
      targetSkills: ["emotion_recognition", "helping"],
      greetingTemplate: "Merhaba {{childName}}!",
      characterAssets: {
        happyAssetId: "scene-lost-toy",
        sadAssetId: "scene-lost-toy",
      },
      steps: [
        {
          id: "choose-balloon",
          type: "choice",
          prompt: "Bir balon seç.",
          choices: [
            {
              id: "red",
              accessibilityLabel: "Kırmızı balon",
              visual: { kind: "balloon", color: "#F46F5E" },
              acknowledgement: "Kırmızı balonu seçtin.",
            },
            {
              id: "blue",
              accessibilityLabel: "Mavi balon",
              visual: { kind: "balloon", color: "#55A9D6" },
              acknowledgement: "Mavi balonu seçtin.",
            },
          ],
        },
        {
          id: "notice-emotion",
          type: "emotion_choice",
          prompt: "Mino nasıl hissediyor olabilir?",
          choices: [
            {
              id: "sad",
              emotion: "sad",
              accessibilityLabel: "Üzgün yüz",
              supportiveFeedback: { narration: "Üzgün olabileceğini düşündün." },
            },
            {
              id: "scared",
              emotion: "scared",
              accessibilityLabel: "Korkmuş yüz",
              supportiveFeedback: { narration: "Korkmuş olabileceğini düşündün." },
            },
          ],
          storyResolution: { narration: "Bu hikâyede Mino üzgün hissediyor." },
        },
      ],
    },
  ],
} as const;

describe("contentVersionSchema", () => {
  it("keeps the generated JSON Schema synchronized with Zod", () => {
    expect(generatedJsonSchema).toEqual({
      $id: "https://adaptive-learning-for-kids.dev/schemas/content-version.schema.json",
      title: "Adaptive Learning Content Version",
      ...z.toJSONSchema(contentVersionSchema, { target: "draft-2020-12" }),
    });
  });

  it("accepts content with supportive feedback for every choice", () => {
    expect(contentVersionSchema.parse(validContent)).toEqual(validContent);
  });

  it("rejects a choice without supportive feedback", () => {
    const invalidContent = structuredClone(validContent) as Record<string, unknown>;
    const activities = invalidContent.activities as Array<Record<string, unknown>>;
    const choices = activities[0].choices as Array<Record<string, unknown>>;

    delete choices[0].supportiveFeedback;

    expect(contentVersionSchema.safeParse(invalidContent).success).toBe(false);
  });

  it("rejects isCorrect instead of treating an emotion as the only right answer", () => {
    const invalidContent = structuredClone(validContent) as Record<string, unknown>;
    const activities = invalidContent.activities as Array<Record<string, unknown>>;
    const choices = activities[0].choices as Array<Record<string, unknown>>;

    choices[0].isCorrect = true;

    expect(contentVersionSchema.safeParse(invalidContent).success).toBe(false);
  });

  it("requires at least two emotion choices", () => {
    const invalidContent = structuredClone(validContent) as Record<string, unknown>;
    const activities = invalidContent.activities as Array<Record<string, unknown>>;

    activities[0].choices = [
      {
        id: "sad",
        emotion: "sad",
        assetId: "emotion-sad",
        supportiveFeedback: { narration: "Üzgün hissetmiş olabilir." },
      },
    ];

    expect(contentVersionSchema.safeParse(invalidContent).success).toBe(false);
  });

  it("rejects an unsupported age band", () => {
    const invalidContent = structuredClone(validContent) as Record<string, unknown>;
    const activities = invalidContent.activities as Array<Record<string, unknown>>;

    activities[0].ageBands = ["3-5"];

    expect(contentVersionSchema.safeParse(invalidContent).success).toBe(false);
  });

  it("requires supportive feedback for every emotion choice inside a story", () => {
    const invalidContent = structuredClone(validContent) as Record<string, unknown>;
    const stories = invalidContent.stories as Array<Record<string, unknown>>;
    const steps = stories[0].steps as Array<Record<string, unknown>>;
    const emotionStep = steps[1];
    const choices = emotionStep.choices as Array<Record<string, unknown>>;

    delete choices[0].supportiveFeedback;

    expect(contentVersionSchema.safeParse(invalidContent).success).toBe(false);
  });
});
