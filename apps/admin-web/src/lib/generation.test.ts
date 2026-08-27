import { contentVersionSchema, storySchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import {
  buildGenerationSkeleton,
  isUsableGenerationAsset,
  parseManualGenerationInput,
  themeConflictsWithAsset,
} from "./generation";

describe("manual content generation", () => {
  it("accepts a bounded generation request", () => {
    expect(
      parseManualGenerationInput({
        flowId: "surprise-and-support",
        theme: "yağmurlu bir gün",
        targetEmotion: "sad",
        sceneAssetId: "scene-thunder",
        sendToReview: true,
      }),
    ).toMatchObject({ theme: "yağmurlu bir gün", sendToReview: true });
  });

  it("rejects missing or oversized free text", () => {
    expect(() =>
      parseManualGenerationInput({
        flowId: "surprise-and-support",
        theme: "x".repeat(161),
        targetEmotion: "sad",
        sceneAssetId: "scene-thunder",
      }),
    ).toThrow("Geçersiz theme alanı.");
  });

  it("allows bundled assets and only cleared external assets", () => {
    const content = contentVersionSchema.parse(contentJson);
    const bundled = content.assets.find((asset) => asset.id === "scene-lost-toy");
    const pending = content.assets.find(
      (asset) => asset.id === "character-mirmir-red-balloon-playing-video",
    );
    expect(bundled && isUsableGenerationAsset(bundled)).toBe(true);
    expect(pending && isUsableGenerationAsset(pending)).toBe(false);
  });

  it("rejects themes that conflict with the selected scene semantics", () => {
    const content = contentVersionSchema.parse(contentJson);
    const lostToy = content.assets.find((asset) => asset.id === "scene-lost-toy");
    expect(lostToy).toBeDefined();
    if (!lostToy) return;

    expect(themeConflictsWithAsset("Mino oyuncak trenini arıyor", lostToy)).toBe(true);
    expect(themeConflictsWithAsset("Mino oyuncak ayısını arıyor", lostToy)).toBe(false);
  });

  it("creates a unique story while preserving template mechanics", () => {
    const template = storySchema.parse({
      id: "template",
      version: 1,
      title: "Başlık",
      ageBands: ["2-4"],
      targetSkills: ["emotion_recognition"],
      greetingTemplate: "Merhaba {{childName}}",
      sceneAssetId: "old-scene",
      characterAssets: { happyAssetId: "happy", sadAssetId: "sad" },
      steps: [{ id: "end", type: "closing", narration: "Bitti." }],
    });
    expect(
      buildGenerationSkeleton({ template, sceneAssetId: "new-scene", requestId: "12345678-abcd" }),
    ).toMatchObject({
      id: "template-v-12345678",
      sceneAssetId: "new-scene",
      steps: template.steps,
    });
  });
});
