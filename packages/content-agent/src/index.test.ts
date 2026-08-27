import type { Story } from "@adaptive/content-schema";
import { describe, expect, it } from "vitest";
import {
  type ApprovedGuidance,
  CONTENT_AGENT_VERSION,
  type ContentGenerationAudit,
  deterministicStoryReview,
  generateStoryDraft,
  retrieveGuidance,
  reviewAssetNarrativeConsistency,
  routeGenerationResult,
  SAFETY_RULES_VERSION,
  type StructuredModel,
} from "./index";

const skeleton: Story = {
  id: "mino-balloon",
  version: 2,
  title: "Mino'nun Balonu",
  ageBands: ["2-4"],
  targetSkills: ["emotion-recognition"],
  greetingTemplate: "Merhaba {{childName}}!",
  sceneAssetId: "scene-balloons",
  characterAssets: { happyAssetId: "mino-happy", sadAssetId: "mino-sad" },
  steps: [
    {
      id: "event-1",
      type: "event",
      narration: "Mino'nun balonu yavaşça söndü.",
    },
    {
      id: "emotion-1",
      type: "emotion_choice",
      prompt: "Mino nasıl hissediyor olabilir?",
      choices: [
        {
          id: "sad-choice",
          emotion: "sad",
          accessibilityLabel: "Üzgün yüz",
          supportiveFeedback: { narration: "Üzgün hissetmiş olabilir." },
        },
        {
          id: "angry-choice",
          emotion: "angry",
          accessibilityLabel: "Kızgın yüz",
          supportiveFeedback: { narration: "Kızgın hissetmiş olabilir." },
        },
      ],
      storyResolution: { narration: "İki duygu da anlaşılır." },
    },
    { id: "close-1", type: "closing", narration: "Mino yeniden denedi." },
  ],
};

const guidance: ApprovedGuidance = {
  version: "guide-v1",
  reviewedAt: "2026-08-27T00:00:00.000Z",
  sources: [
    {
      id: "emotion",
      title: "Duygular",
      tags: ["duygu", "geri bildirim", "2-4"],
      content: "Duyguyu yargılama.",
    },
    {
      id: "safety",
      title: "Güvenlik",
      tags: ["güvenlik", "2-4"],
      content: "Kısa ve sakin anlat.",
    },
  ],
};

const allowedAssets = ["scene-balloons", "mino-happy", "mino-sad"];

function model(model: string, response: unknown): StructuredModel {
  return { model, generateJson: async () => response };
}

function harness(candidate: unknown, supervisor: unknown, cached: Story | null = skeleton) {
  const audits: ContentGenerationAudit[] = [];
  return {
    audits,
    run: () =>
      generateStoryDraft({
        request: {
          requestId: "request-1",
          skeleton,
          allowedAssetIds: allowedAssets,
          variationSeed: "rainy-day-1",
          locale: "tr-TR",
        },
        generator: model("generator-test", candidate),
        supervisor: model("supervisor-test", supervisor),
        guidance,
        cache: { get: async () => cached },
        auditSink: {
          save: async (audit) => {
            audits.push(audit);
          },
        },
        now: () => "2026-08-27T12:00:00.000Z",
      }),
  };
}

describe("content agent", () => {
  it("rejects narrative terms that contradict locked asset semantics", () => {
    const story: Story = {
      ...skeleton,
      sceneAssetId: "character-mirmir-red-balloon-happy",
      steps: skeleton.steps.map((step) =>
        step.type === "event" ? { ...step, narration: "Mırmır üzgün görünüyor." } : step,
      ),
    };
    expect(
      reviewAssetNarrativeConsistency(story, [
        {
          id: "character-mirmir-red-balloon-happy",
          type: "image",
          uri: "app-assets:characters/mirmir-happy.jpg",
          mimeType: "image/jpeg",
          semantic: {
            character: "mirmir",
            object: "red-balloon",
            eventState: "holding",
            emotion: "happy",
            allowedNarrativeTerms: ["mutlu"],
            prohibitedNarrativeTerms: ["üzgün"],
            reviewStatus: "approved",
            rightsStatus: "cleared",
            provenance: {
              source: "owned",
              aiGenerated: false,
              generatedByUser: true,
              thirdPartyReferencesDeclared: false,
              disclosure: "Test asset",
            },
          },
        },
      ]),
    ).toContain("asset_semantic_mismatch");
  });
  it("retrieves only matching expert-reviewed guidance", () => {
    expect(retrieveGuidance(guidance, ["duygu"])).toEqual([guidance.sources[0]]);
  });

  it("creates only a draft after deterministic and independent supervisor approval", async () => {
    const candidate = {
      ...skeleton,
      version: 3,
      title: "Mino'nun Uçan Balonu",
      steps: skeleton.steps.map((step) =>
        step.type === "event" ? { ...step, narration: "Balon hafifçe puf diye söndü." } : step,
      ),
    };
    const { run, audits } = harness(candidate, { approved: true, reasonCodes: [], notes: [] });

    await expect(run()).resolves.toMatchObject({ status: "draft", draft: { version: 3 } });
    expect(audits).toEqual([
      expect.objectContaining({
        status: "draft",
        generatorModel: "generator-test",
        supervisorModel: "supervisor-test",
        guidanceVersion: "guide-v1",
        promptHash: expect.stringMatching(/^fnv1a-/),
      }),
    ]);
  });

  it("rejects a changed mechanic before calling the supervisor", async () => {
    const candidate = {
      ...skeleton,
      steps: skeleton.steps.filter((step) => step.type !== "emotion_choice"),
    };
    const { run } = harness(candidate, { approved: true, reasonCodes: [], notes: [] });
    await expect(run()).resolves.toMatchObject({
      status: "fallback",
      audit: { rejectionReasons: ["skeleton_changed"] },
    });
  });

  it("rejects forbidden assets, diagnosis, frightening language and judgmental emotions", () => {
    const unsafe: Story = {
      ...skeleton,
      sceneAssetId: "model-invented-image",
      steps: skeleton.steps.map((step) => {
        if (step.type !== "emotion_choice") return step;
        return {
          ...step,
          choices: [
            {
              ...step.choices[0],
              supportiveFeedback: { narration: "Aferin, doğru cevap; Mino otistik." },
            },
            step.choices[1],
          ],
          storyResolution: { narration: "Kanlı bir canavar geldi." },
        };
      }),
    };
    expect(deterministicStoryReview(unsafe, skeleton, allowedAssets)).toEqual(
      expect.arrayContaining([
        "asset_not_allowed",
        "judgmental_emotion_feedback",
        "diagnostic_or_scoring_language",
        "frightening_content",
      ]),
    );
  });

  it("falls back to the last approved cached story on invalid model output", async () => {
    const cached = { ...skeleton, version: 7, title: "Son Onaylı Hikâye" };
    const { run, audits } = harness("not-json", {}, cached);
    await expect(run()).resolves.toMatchObject({
      status: "fallback",
      story: { version: 7, title: "Son Onaylı Hikâye" },
    });
    expect(audits[0]).toMatchObject({ status: "rejected", rejectionReasons: ["invalid_schema"] });
  });

  it("rejects a supervisor refusal and records structured reasons", async () => {
    const { run } = harness(skeleton, {
      approved: false,
      reasonCodes: ["age_inappropriate_language"],
      notes: ["Cümleler uzun."],
    });
    await expect(run()).resolves.toMatchObject({
      status: "fallback",
      audit: { rejectionReasons: ["age_inappropriate_language"] },
    });
  });
});

describe("R9 publication routing", () => {
  const draftResult = {
    status: "draft" as const,
    draft: skeleton,
    audit: {
      requestId: "route-request",
      storyId: skeleton.id,
      status: "draft" as const,
      generatorModel: "generator",
      supervisorModel: "reviewer",
      promptHash: "hash",
      schemaVersion: CONTENT_AGENT_VERSION,
      safetyRulesVersion: SAFETY_RULES_VERSION,
      guidanceVersion: "guide-v1",
      rejectionReasons: [],
      generatedStoryVersion: skeleton.version,
      createdAt: "2026-08-27T00:00:00.000Z",
    },
  };

  it("publishes a high-confidence clean draft", async () => {
    const published: string[] = [];
    const result = await routeGenerationResult({
      result: draftResult,
      contentVersion: "1.1.0",
      confidence: 0.96,
      sink: {
        publish: async ({ requestId }) => {
          published.push(requestId);
        },
        enqueueReview: async () => {
          throw new Error("must not queue");
        },
      },
    });
    expect(result.status).toBe("published");
    expect(published).toEqual(["route-request"]);
  });

  it("queues low-confidence content for exactly fifteen days", async () => {
    let queued: { reasons: string[]; expiresAt: string } | null = null;
    const result = await routeGenerationResult({
      result: draftResult,
      contentVersion: "1.1.0",
      confidence: 0.72,
      suspicionReasons: ["reviewer_disagreement"],
      now: () => new Date("2026-08-27T00:00:00.000Z"),
      sink: {
        publish: async () => {
          throw new Error("must not publish");
        },
        enqueueReview: async ({ suspicionReasons, expiresAt }) => {
          queued = { reasons: suspicionReasons, expiresAt };
        },
      },
    });
    expect(result.status).toBe("queued_for_review");
    expect(queued).toEqual({
      reasons: ["reviewer_disagreement", "low_confidence"],
      expiresAt: "2026-09-11T00:00:00.000Z",
    });
  });

  it("never publishes fallback content as a new version", async () => {
    const result = await routeGenerationResult({
      result: {
        status: "fallback",
        story: skeleton,
        audit: {
          ...draftResult.audit,
          status: "rejected",
          rejectionReasons: ["invalid_json"],
          generatedStoryVersion: null,
        },
      },
      contentVersion: "1.1.0",
      confidence: 1,
      sink: {
        publish: async () => {
          throw new Error("must not publish");
        },
        enqueueReview: async () => {
          throw new Error("must not queue");
        },
      },
    });
    expect(result.status).toBe("not_publishable");
  });
});
