import { describe, expect, it } from "vitest";
import { z } from "zod";
import generatedJsonSchema from "../generated/content-version.schema.json";
import { contentVersionSchema } from "./schemas";

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
