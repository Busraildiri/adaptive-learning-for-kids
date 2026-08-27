import {
  type Asset,
  type AssetSemantic,
  type Story,
  type StoryStep,
  storySchema,
} from "@adaptive/content-schema";
import { z } from "zod";

export const CONTENT_AGENT_VERSION = "content-agent-v1" as const;
export const SAFETY_RULES_VERSION = "story-safety-tr-v1" as const;

const rejectionCodeSchema = z.enum([
  "invalid_json",
  "invalid_schema",
  "skeleton_changed",
  "asset_not_allowed",
  "asset_not_approved",
  "asset_semantic_mismatch",
  "judgmental_emotion_feedback",
  "diagnostic_or_scoring_language",
  "frightening_content",
  "age_inappropriate_language",
  "supervisor_rejected",
  "supervisor_invalid_response",
]);
export type RejectionCode = z.infer<typeof rejectionCodeSchema>;

export const supervisorDecisionSchema = z
  .strictObject({
    approved: z.boolean(),
    reasonCodes: z.array(rejectionCodeSchema),
    notes: z.array(z.string().trim().min(1).max(300)).max(10),
  })
  .refine((decision) => !decision.approved || decision.reasonCodes.length === 0, {
    message: "Approved decisions cannot include rejection reasons.",
  });
export type SupervisorDecision = z.infer<typeof supervisorDecisionSchema>;

export interface ApprovedGuidanceSource {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

export interface ApprovedGuidance {
  version: string;
  reviewedAt: string;
  sources: ApprovedGuidanceSource[];
}

export interface StoryGenerationRequest {
  requestId: string;
  skeleton: Story;
  allowedAssetIds: string[];
  variationSeed: string;
  locale: "tr-TR";
  assetCatalog?: Asset[];
}

function stepNarrative(step: StoryStep): string[] {
  const values: string[] = [];
  if (step.type === "event" || step.type === "closing" || step.type === "breathing") {
    values.push(step.narration);
  }
  if (step.type === "tap") values.push(step.prompt, step.completionNarration);
  if (step.type === "choice" || step.type === "help_choice") values.push(step.prompt);
  return values;
}

function narrativeTextForAsset(story: Story, assetId: string): string {
  const eventIndex = story.steps.findIndex((step) => step.type === "event");
  const recoveryIndex = story.steps.findIndex(
    (step, index) =>
      index > eventIndex &&
      (step.type === "help_choice" || step.type === "breathing" || step.type === "closing"),
  );
  if (assetId === story.characterAssets.sadAssetId && eventIndex >= 0) {
    const end = recoveryIndex < 0 ? story.steps.length : recoveryIndex;
    return story.steps
      .slice(eventIndex, end)
      .flatMap(stepNarrative)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
  }
  if (assetId === story.characterAssets.happyAssetId && eventIndex >= 0) {
    const values = [story.title, story.greetingTemplate];
    values.push(...story.steps.slice(0, eventIndex).flatMap(stepNarrative));
    if (recoveryIndex >= 0) values.push(...story.steps.slice(recoveryIndex).flatMap(stepNarrative));
    return values.join(" ").toLocaleLowerCase("tr-TR");
  }
  return [story.title, story.greetingTemplate, ...story.steps.flatMap(stepNarrative)]
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

export function reviewAssetNarrativeConsistency(
  story: Story,
  assetCatalog: Asset[],
): RejectionCode[] {
  const reasons = new Set<RejectionCode>();
  const referencedIds = new Set([
    story.sceneAssetId,
    story.introVideoAssetId,
    story.characterAssets.happyAssetId,
    story.characterAssets.sadAssetId,
  ]);
  for (const asset of assetCatalog) {
    if (!referencedIds.has(asset.id) || !asset.semantic) continue;
    const narrative = narrativeTextForAsset(story, asset.id);
    if (asset.semantic.reviewStatus !== "approved" || asset.semantic.rightsStatus !== "cleared") {
      reasons.add("asset_not_approved");
    }
    if (
      asset.semantic.prohibitedNarrativeTerms.some((term) =>
        narrative.includes(term.toLocaleLowerCase("tr-TR")),
      )
    ) {
      reasons.add("asset_semantic_mismatch");
    }
  }
  return [...reasons];
}

function approvedAssetSemantics(assets: Asset[]): Record<string, AssetSemantic> {
  return Object.fromEntries(
    assets
      .filter(
        (asset): asset is Asset & { semantic: AssetSemantic } =>
          asset.semantic?.reviewStatus === "approved" && asset.semantic.rightsStatus === "cleared",
      )
      .map((asset) => [asset.id, asset.semantic]),
  );
}

export interface StructuredModel {
  model: string;
  generateJson(input: {
    system: string;
    prompt: string;
    schemaName: string;
    schemaDescription: string;
    jsonSchema: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface ApprovedStoryCache {
  get(storyId: string): Promise<Story | null>;
}

export interface AuditSink {
  save(record: ContentGenerationAudit): Promise<void>;
}

export interface ContentGenerationAudit {
  requestId: string;
  storyId: string;
  status: "draft" | "rejected";
  generatorModel: string;
  supervisorModel: string;
  promptHash: string;
  schemaVersion: typeof CONTENT_AGENT_VERSION;
  safetyRulesVersion: typeof SAFETY_RULES_VERSION;
  guidanceVersion: string;
  rejectionReasons: RejectionCode[];
  generatedStoryVersion: number | null;
  createdAt: string;
}

export type GenerationResult =
  | { status: "draft"; draft: Story; audit: ContentGenerationAudit }
  | { status: "fallback"; story: Story; audit: ContentGenerationAudit };

export interface PublicationSink {
  publish(input: { requestId: string; story: Story; contentVersion: string }): Promise<void>;
  enqueueReview(input: {
    requestId: string;
    story: Story;
    contentVersion: string;
    suspicionReasons: string[];
    expiresAt: string;
  }): Promise<void>;
}

export type PublicationRoute =
  | { status: "published"; requestId: string }
  | { status: "queued_for_review"; requestId: string; expiresAt: string }
  | { status: "not_publishable"; requestId: string };

export async function routeGenerationResult(input: {
  result: GenerationResult;
  contentVersion: string;
  confidence: number;
  suspicionReasons?: string[];
  sink: PublicationSink;
  now?: () => Date;
}): Promise<PublicationRoute> {
  const requestId = input.result.audit.requestId;
  if (input.result.status !== "draft") return { status: "not_publishable", requestId };

  const reasons = [...new Set(input.suspicionReasons ?? [])];
  const suspicious = input.confidence < 0.9 || reasons.length > 0;
  if (suspicious) {
    if (input.confidence < 0.9 && !reasons.includes("low_confidence")) {
      reasons.push("low_confidence");
    }
    const expiresAt = new Date(
      (input.now ?? (() => new Date()))().getTime() + 15 * 24 * 60 * 60 * 1_000,
    ).toISOString();
    await input.sink.enqueueReview({
      requestId,
      story: input.result.draft,
      contentVersion: input.contentVersion,
      suspicionReasons: reasons,
      expiresAt,
    });
    return { status: "queued_for_review", requestId, expiresAt };
  }

  await input.sink.publish({
    requestId,
    story: input.result.draft,
    contentVersion: input.contentVersion,
  });
  return { status: "published", requestId };
}

const judgmentalPatterns = [
  /yanlış\s+(duygu|cevap)/iu,
  /doğru\s+(duygu|cevap)/iu,
  /böyle\s+hissetmemelisin/iu,
  /aferin,?\s+doğru/iu,
];
const diagnosticPatterns = [
  /(otizm|otistik|adhd|dehb|anksiyete|depresyon|tanı|teşhis)/iu,
  /(zeka|beceri|duygu)\s*(puanı|skoru)/iu,
  /yaşıtlarından\s+(geri|ileri)/iu,
];
const frighteningPatterns = [/(öldü|ölüm|kanlı|bıçak|silah|kaçırıldı|canavar seni|terk etti)/iu];

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function allText(story: Story): string[] {
  const values: string[] = [story.title, story.greetingTemplate];
  for (const step of story.steps) {
    if ("prompt" in step) values.push(step.prompt);
    if ("narration" in step) values.push(step.narration);
    if ("completionNarration" in step) values.push(step.completionNarration);
    if ("storyResolution" in step) values.push(step.storyResolution.narration);
    if ("choices" in step) {
      for (const choice of step.choices) {
        if ("supportiveFeedback" in choice) {
          values.push(choice.supportiveFeedback.narration);
          if (choice.supportiveFeedback.followUpPrompt) {
            values.push(choice.supportiveFeedback.followUpPrompt);
          }
        }
        if ("acknowledgement" in choice) values.push(choice.acknowledgement);
        if ("resultNarration" in choice) values.push(choice.resultNarration);
      }
    }
  }
  return values;
}

function mechanicSignature(step: StoryStep): unknown {
  const base = { id: step.id, type: step.type };
  if (step.type === "tap") return { ...base, requiredTaps: step.requiredTaps };
  if (step.type === "breathing") return { ...base, cycles: step.cycles };
  if (step.type === "choice") {
    return {
      ...base,
      choices: step.choices.map((choice) => ({ id: choice.id, visual: choice.visual })),
    };
  }
  if (step.type === "emotion_choice") {
    return { ...base, choices: step.choices.map(({ id, emotion }) => ({ id, emotion })) };
  }
  if (step.type === "help_choice") {
    return { ...base, choices: step.choices.map(({ id, action }) => ({ id, action })) };
  }
  return base;
}

export function retrieveGuidance(
  guidance: ApprovedGuidance,
  tags: string[],
  limit = 3,
): ApprovedGuidanceSource[] {
  const normalized = new Set(tags.map((tag) => tag.toLocaleLowerCase("tr-TR")));
  return guidance.sources
    .map((source) => ({
      source,
      score: source.tags.filter((tag) => normalized.has(tag.toLocaleLowerCase("tr-TR"))).length,
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) => right.score - left.score || left.source.id.localeCompare(right.source.id),
    )
    .slice(0, limit)
    .map(({ source }) => source);
}

export function deterministicStoryReview(
  candidate: Story,
  skeleton: Story,
  allowedAssetIds: string[],
): RejectionCode[] {
  const reasons = new Set<RejectionCode>();
  const skeletonMechanics = skeleton.steps.map(mechanicSignature);
  const candidateMechanics = candidate.steps.map(mechanicSignature);
  if (
    candidate.id !== skeleton.id ||
    JSON.stringify(candidate.ageBands) !== JSON.stringify(skeleton.ageBands) ||
    candidate.introVideoAssetId !== skeleton.introVideoAssetId ||
    JSON.stringify(candidate.characterAssets) !== JSON.stringify(skeleton.characterAssets) ||
    JSON.stringify(candidateMechanics) !== JSON.stringify(skeletonMechanics)
  ) {
    reasons.add("skeleton_changed");
  }

  const allowed = new Set(allowedAssetIds);
  const referencedAssets = [
    candidate.sceneAssetId,
    candidate.introVideoAssetId,
    candidate.characterAssets.happyAssetId,
    candidate.characterAssets.sadAssetId,
    ...candidate.steps.flatMap((step) => {
      const assets: Array<string | undefined> = [];
      if ("storyResolution" in step) assets.push(step.storyResolution.audioAssetId);
      if ("choices" in step) {
        for (const choice of step.choices) {
          if ("supportiveFeedback" in choice) {
            assets.push(choice.supportiveFeedback.audioAssetId);
          }
        }
      }
      return assets;
    }),
  ].filter((asset): asset is string => Boolean(asset));
  if (referencedAssets.some((asset) => !allowed.has(asset))) reasons.add("asset_not_allowed");

  const texts = allText(candidate);
  if (texts.some((text) => diagnosticPatterns.some((pattern) => pattern.test(text)))) {
    reasons.add("diagnostic_or_scoring_language");
  }
  if (texts.some((text) => frighteningPatterns.some((pattern) => pattern.test(text)))) {
    reasons.add("frightening_content");
  }
  if (texts.some((text) => text.split(/\s+/u).length > 35 || text.length > 240)) {
    reasons.add("age_inappropriate_language");
  }
  const feedback = candidate.steps
    .filter((step) => step.type === "emotion_choice")
    .flatMap((step) => step.choices.map((choice) => choice.supportiveFeedback.narration));
  if (feedback.some((text) => judgmentalPatterns.some((pattern) => pattern.test(text)))) {
    reasons.add("judgmental_emotion_feedback");
  }
  return [...reasons];
}

function buildGeneratorPrompt(
  request: StoryGenerationRequest,
  sources: ApprovedGuidanceSource[],
): string {
  return JSON.stringify({
    task: "Aynı oyun mekaniğini koruyarak kısa bir Türkçe anlatım varyantı üret.",
    variationSeed: request.variationSeed,
    immutableRules: {
      storyId: request.skeleton.id,
      ageBands: request.skeleton.ageBands,
      allowedAssetIds: request.allowedAssetIds,
      approvedAssetSemantics: approvedAssetSemantics(request.assetCatalog ?? []),
      stepMechanics: request.skeleton.steps.map(mechanicSignature),
      outputStatus: "draft",
      noCorrectEmotion: true,
    },
    approvedGuidance: sources,
    skeleton: request.skeleton,
  });
}

function buildSupervisorPrompt(
  candidate: Story,
  sources: ApprovedGuidanceSource[],
  assets: Asset[],
): string {
  return JSON.stringify({
    task: "Taslağı çocuk güvenliği, gelişimsel uygunluk ve yargılamayan dil açısından denetle.",
    candidate,
    approvedGuidance: sources,
    referencedAssetSemantics: Object.fromEntries(
      assets
        .filter((asset) =>
          [
            candidate.sceneAssetId,
            candidate.introVideoAssetId,
            candidate.characterAssets.happyAssetId,
            candidate.characterAssets.sadAssetId,
          ].includes(asset.id),
        )
        .map((asset) => [asset.id, asset.semantic ?? null]),
    ),
    rejectWhen: [
      "tek doğru duygu",
      "yargılayıcı geri bildirim",
      "tanı veya beceri puanı",
      "korkutucu ayrıntı",
      "2-4 yaşa uygun olmayan uzun veya soyut dil",
      "metindeki duygu veya olayın asset emotion/eventState etiketiyle çelişmesi",
    ],
  });
}

export async function generateStoryDraft(input: {
  request: StoryGenerationRequest;
  generator: StructuredModel;
  supervisor: StructuredModel;
  guidance: ApprovedGuidance;
  cache: ApprovedStoryCache;
  auditSink: AuditSink;
  now?: () => string;
}): Promise<GenerationResult> {
  const sources = retrieveGuidance(input.guidance, ["duygu", "geri bildirim", "güvenlik", "2-4"]);
  const generatorPrompt = buildGeneratorPrompt(input.request, sources);
  const baseAudit = {
    requestId: input.request.requestId,
    storyId: input.request.skeleton.id,
    generatorModel: input.generator.model,
    supervisorModel: input.supervisor.model,
    promptHash: stableHash(generatorPrompt),
    schemaVersion: CONTENT_AGENT_VERSION,
    safetyRulesVersion: SAFETY_RULES_VERSION,
    guidanceVersion: input.guidance.version,
    createdAt: (input.now ?? (() => new Date().toISOString()))(),
  };
  const reject = async (rejectionReasons: RejectionCode[]): Promise<GenerationResult> => {
    const audit: ContentGenerationAudit = {
      ...baseAudit,
      status: "rejected",
      rejectionReasons: [...new Set(rejectionReasons)],
      generatedStoryVersion: null,
    };
    await input.auditSink.save(audit);
    const fallback = await input.cache.get(input.request.skeleton.id);
    return { status: "fallback", story: fallback ?? input.request.skeleton, audit };
  };

  let rawCandidate: unknown;
  try {
    rawCandidate = await input.generator.generateJson({
      system: "Yalnızca JSON üret. İçerik her zaman taslaktır ve çocuğa doğrudan sunulmaz.",
      prompt: generatorPrompt,
      schemaName: "storySchema",
      schemaDescription: "@adaptive/content-schema storySchema strict JSON",
      jsonSchema: z.toJSONSchema(storySchema) as Record<string, unknown>,
    });
  } catch {
    return reject(["invalid_json"]);
  }
  const parsedCandidate = storySchema.safeParse(rawCandidate);
  if (!parsedCandidate.success) return reject(["invalid_schema"]);
  const deterministicReasons = deterministicStoryReview(
    parsedCandidate.data,
    input.request.skeleton,
    input.request.allowedAssetIds,
  );
  deterministicReasons.push(
    ...reviewAssetNarrativeConsistency(parsedCandidate.data, input.request.assetCatalog ?? []),
  );
  if (deterministicReasons.length > 0) return reject(deterministicReasons);

  let rawDecision: unknown;
  try {
    rawDecision = await input.supervisor.generateJson({
      system: "Üreticiden bağımsız denetleyicisin. Yalnızca yapılandırılmış JSON kararı üret.",
      prompt: buildSupervisorPrompt(
        parsedCandidate.data,
        sources,
        input.request.assetCatalog ?? [],
      ),
      schemaName: "supervisorDecisionSchema",
      schemaDescription: "{ approved: boolean, reasonCodes: RejectionCode[], notes: string[] }",
      jsonSchema: z.toJSONSchema(supervisorDecisionSchema) as Record<string, unknown>,
    });
  } catch {
    return reject(["supervisor_invalid_response"]);
  }
  const decision = supervisorDecisionSchema.safeParse(rawDecision);
  if (!decision.success) return reject(["supervisor_invalid_response"]);
  if (!decision.data.approved) {
    return reject(
      decision.data.reasonCodes.length ? decision.data.reasonCodes : ["supervisor_rejected"],
    );
  }

  const audit: ContentGenerationAudit = {
    ...baseAudit,
    status: "draft",
    rejectionReasons: [],
    generatedStoryVersion: parsedCandidate.data.version,
  };
  await input.auditSink.save(audit);
  return { status: "draft", draft: parsedCandidate.data, audit };
}

export type { GeminiStructuredModelOptions } from "./providers/gemini";
export { createGeminiStructuredModel, GeminiProviderError } from "./providers/gemini";
export type { OpenAIStructuredModelOptions } from "./providers/openai";
export { createOpenAIStructuredModel, OpenAIProviderError } from "./providers/openai";
export type { OpenAIContentModels } from "./providers/openaiRuntime";
export { createOpenAIContentModelsFromEnv } from "./providers/openaiRuntime";
export type { SupabasePublicationSinkOptions } from "./publication/supabase";
export { createSupabasePublicationSink, PublicationSinkError } from "./publication/supabase";
