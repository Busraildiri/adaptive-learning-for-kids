import {
  type ApprovedGuidance,
  type ContentGenerationAudit,
  createOpenAIContentModelsFromEnv,
  createSupabasePublicationSink,
  generateStoryDraft,
  routeGenerationResult,
} from "@adaptive/content-agent";
import guidanceJson from "@adaptive/content-agent/guidance/tr-TR";
import { contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildGenerationSkeleton,
  isAllowedSceneAsset,
  isUsableGenerationAsset,
  parseManualGenerationInput,
  themeConflictsWithAsset,
} from "../../../lib/generation";
import { findStoryBlueprint } from "../../../lib/storyBlueprints";

export const runtime = "nodejs";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} sunucu ortam değişkeni eksik.`);
  return value;
}

async function requireContentAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Yönetici oturumu gerekli.");
  const token = authorization.slice("Bearer ".length);
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: userData, error: userError }, adminResult] = await Promise.all([
    client.auth.getUser(token),
    client.rpc("is_content_admin"),
  ]);
  if (userError || !userData.user || adminResult.error || !adminResult.data) {
    throw new Error("İçerik yöneticisi yetkisi gerekli.");
  }
  return userData.user.id;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    await requireContentAdmin(request, supabaseUrl, publishableKey);

    const input = parseManualGenerationInput(await request.json());
    const content = contentVersionSchema.parse(contentJson);
    const blueprint = findStoryBlueprint(input.flowId);
    if (!blueprint) throw new Error("Seçilen olay akışı bulunamadı.");
    const template = content.stories.find((story) => story.id === blueprint.mechanicsSourceStoryId);
    if (!template) throw new Error("Olay akışının mekanik kaynağı bulunamadı.");
    const asset = content.assets.find((candidate) => candidate.id === input.sceneAssetId);
    if (!asset || !isAllowedSceneAsset(asset, template)) {
      throw new Error("Seçilen asset üretim için onaylı değil.");
    }
    if (themeConflictsWithAsset(input.theme, asset)) {
      throw new Error("Tema seçilen sahne asset’iyle anlamsal olarak çelişiyor.");
    }
    const supportedEmotions = template.steps
      .filter((step) => step.type === "emotion_choice")
      .flatMap((step) => step.choices.map((choice) => choice.emotion));
    if (!supportedEmotions.includes(input.targetEmotion as (typeof supportedEmotions)[number])) {
      throw new Error("Hedef duygu seçilen şablonla uyumlu değil.");
    }

    const requestId = crypto.randomUUID();
    const skeleton = buildGenerationSkeleton({
      template,
      sceneAssetId: input.sceneAssetId,
      requestId,
    });
    const models = createOpenAIContentModelsFromEnv(process.env);
    const auditRecords: ContentGenerationAudit[] = [];
    const generate = (variationSeed: string) =>
      generateStoryDraft({
        request: {
          requestId,
          skeleton,
          allowedAssetIds: content.assets.filter(isUsableGenerationAsset).map((item) => item.id),
          variationSeed,
          locale: "tr-TR",
          assetCatalog: content.assets,
          requireNarrativeVariation: true,
        },
        generator: models.generator,
        supervisor: models.supervisor,
        guidance: guidanceJson as ApprovedGuidance,
        cache: { get: async () => skeleton },
        auditSink: {
          save: async (record) => {
            auditRecords.push(record);
          },
        },
      });

    const baseVariationSeed = `${input.theme}; hedef duygu: ${input.targetEmotion}`;
    let result = await generate(baseVariationSeed);
    if (
      result.status === "fallback" &&
      result.audit.rejectionReasons.length === 1 &&
      result.audit.rejectionReasons[0] === "insufficient_narrative_variation"
    ) {
      result = await generate(
        `${baseVariationSeed}; yeniden deneme: Kaynak hikâyeden açıkça farklı, özgün bir başlık kullan. Olay, soru, geri bildirim ve kapanış anlatımlarını temaya göre baştan yaz.`,
      );
    }
    const audit = auditRecords.at(-1);
    if (!audit) throw new Error("Üretim audit kaydı oluşturulamadı.");

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auditedStory = result.status === "draft" ? result.draft : null;
    const { error: auditError } = await serviceClient.rpc("record_content_generation_run", {
      source_request_id: audit.requestId,
      generated_story_id: audit.storyId,
      run_status: audit.status,
      generator_model_name: audit.generatorModel,
      supervisor_model_name: audit.supervisorModel,
      generation_prompt_hash: audit.promptHash,
      generation_schema_version: audit.schemaVersion,
      generation_safety_rules_version: audit.safetyRulesVersion,
      generation_guidance_version: audit.guidanceVersion,
      generation_rejection_reasons: audit.rejectionReasons,
      generated_story: auditedStory,
      generated_story_version: audit.generatedStoryVersion,
      generated_at: audit.createdAt,
    });
    if (auditError) throw auditError;

    const publication = await routeGenerationResult({
      result,
      contentVersion: content.contentVersion,
      confidence: input.sendToReview ? 0.85 : 1,
      suspicionReasons: input.sendToReview ? ["manual_review_requested"] : [],
      sink: createSupabasePublicationSink({ supabaseUrl, serviceRoleKey }),
    });

    return NextResponse.json({
      requestId,
      storyId: skeleton.id,
      status: publication.status,
      rejectionReasons: audit.rejectionReasons,
      technicalError: result.status === "fallback" ? result.technicalError : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hikâye üretilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
