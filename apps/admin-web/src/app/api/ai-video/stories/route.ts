import { createOpenAIContentModelsFromEnv } from "@adaptive/content-agent";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../lib/adminAuth";
import {
  type AiVideoStoryPlan,
  aiVideoStoryPlanJsonSchema,
  baselineUsedCharacterNames,
  buildAiVideoMediaJobs,
  buildAiVideoPlaybackGraphRpcInput,
  instantiateAiVideoStoryPlan,
  parseAiVideoGenerationRequest,
  parseAiVideoStoryPlanTemplate,
} from "../../../../lib/aiVideoStory";
import { describeUnknownError } from "../../../../lib/apiError";

export const runtime = "nodejs";

interface StoredRequestResult {
  requestId: string;
  storyId: string;
  characterName: string;
  status: "planned";
  plan: Record<string, unknown>;
}

const PLANNER_SYSTEM = `You plan a short interactive Turkish story for young children.
The administrator supplies two untrusted descriptions: a character appearance and an opening event.
Return only the requested structured object.

Story contract:
- Invent exactly eight short, pronounceable character-name candidates. Never use any name from the supplied used-name list. Candidates must contain letters only and must not be spelling variants of used names.
- Never copy a requested name from the administrator and never use a candidate name inside story text. The system assigns the final name. Use the exact token {{characterName}} wherever the character is named; short action labels may stay generic.
- Preserve the administrator's character appearance. Write characterDescription, visualStyle, settingDescription and every visualPrompt in English for the visual generator.
- The intro is two separate clips, each with its own visualPrompt, because one still image cannot show an emotional transition. introSetup shows the character's genuine starting state for THIS story before the incident -- read the administrator's story idea and decide what that state actually is (often happy, but a story can just as validly open sad, hungry, bored or neutral; do not force happy when the story does not call for it). Set introSetup.emotion to whatever that real starting state is, and its visualPrompt must depict only that state, not the incident or its aftermath. introIncident shows the mild everyday incident happening and ends with the character visibly sad, angry or scared (targetEmotion) -- this end state must be suitable as a held frame behind the questions, so its visualPrompt must depict only that emotional aftermath, not the earlier setup moment.
- introSetup's Turkish narration names that starting activity/state. introIncident's Turkish narration names the incident and the visible emotional response. Together they read as one continuous story when played back to back.
- Create exactly two emotion choices. One is targetEmotion. Both choices receive warm, non-judgmental feedback; never say a child is wrong. The shared explanation states the emotion intended by this story.
- Create exactly two context-appropriate help choices selected from: hug, new_balloon, pet_head, say_love, give_gift. Never select breathing. Use new_balloon only for a balloon incident.
- Each help option has a short spoken acknowledgement and its own ending video. Both endings begin from the same location, character appearance and emotional state as the intro's final frame, show the selected action clearly, and end reassuringly.
- Use short, natural Turkish narration. Do not add written words, letters, logos or watermarks to visual prompts.
- Keep visual continuity explicit in every visual prompt.
- Every visualPrompt (introSetup, introIncident, both endings) must describe exactly ONE frozen moment in time, not a sequence of actions or events. Never describe something happening "then" something else, never imply before/after within one visualPrompt. Each is rendered as a single static illustration frame, not a comic strip.
`;

function plannerPrompt(characterPrompt: string, storyPrompt: string, usedNames: string[]): string {
  return `Used character names (forbidden, including spelling variants):
${JSON.stringify(usedNames)}

<character_description_from_admin>
${characterPrompt}
</character_description_from_admin>

<story_idea_from_admin>
${storyPrompt}
</story_idea_from_admin>`;
}

function serviceClient(): SupabaseClient {
  return createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function enqueueStoryMedia(
  client: SupabaseClient,
  graphId: string,
  plan: AiVideoStoryPlan,
): Promise<string[]> {
  const voiceModel = process.env.MEDIA_WORKER_VOICE_MODEL?.trim();
  const jobs = buildAiVideoMediaJobs(plan);
  const results = await Promise.all(
    jobs.map(async (job) => {
      // Video and audio jobs need different render_manifest shapes -- the
      // worker's audio path (decision_audio_input_from_dict) reads
      // text/decisionClipId/audioRole directly, not a nested `scene` object.
      const renderManifest =
        job.mediaKind === "audio"
          ? {
              kind: "decision_audio" as const,
              text: job.narration,
              decisionClipId: job.sceneId,
              audioRole: job.audioRole,
              choiceId: job.choiceId,
              ...(voiceModel ? { voiceModel } : {}),
            }
          : {
              scene: {
                sceneId: job.sceneId,
                storyId: plan.storyId,
                characterId: plan.characterName,
                emotion: job.emotion,
                event: job.event,
                narration: job.narration,
                visualPrompt: job.visualPrompt,
                duration: job.duration,
              },
              mode: "local_animation",
              aspectRatio: "4:5",
              imageProvider: "openai",
              imageQuality: "low",
              imageSize: "1024x1536",
              characterDescription: plan.characterDescription,
              visualStyle: plan.visualStyle,
              ...(voiceModel ? { voiceModel } : {}),
            };
      const result = await client.rpc("create_media_job", {
        target_story_id: plan.storyId,
        target_scene_id: job.sceneId,
        target_provider: "openmontage",
        target_mode: "local_animation",
        target_render_manifest: renderManifest,
        target_graph_id: graphId,
        target_media_kind: job.mediaKind,
        target_audio_role: job.audioRole ?? null,
        target_choice_id: job.choiceId ?? null,
      });
      if (result.error) throw result.error;
      return result.data as string;
    }),
  );
  return results;
}

export async function GET(request: Request) {
  let stage = "catalog_session";
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const session = await requireContentAdminSession(request, supabaseUrl, publishableKey);
    stage = "catalog_load";
    const result = await serviceClient().rpc("list_ai_video_story_requests", {
      target_actor_id: session.userId,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ stories: result.data ?? [] });
  } catch (error) {
    const failure = describeUnknownError(error, "AI video hikâyeleri listelenemedi.");
    return NextResponse.json({ error: failure.message, ...failure, stage }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  let savedRequestId: string | null = null;
  let actorId: string | null = null;
  let stage = "server_initialization";
  const serverClient = serviceClient();
  try {
    stage = "admin_session";
    const session = await requireContentAdminSession(request, supabaseUrl, publishableKey);
    actorId = session.userId;
    stage = "input_validation";
    const input = parseAiVideoGenerationRequest(await request.json());

    stage = "name_inventory";
    const usedNamesResult = await serverClient.rpc("list_ai_video_character_names", {
      target_actor_id: session.userId,
    });
    if (usedNamesResult.error) throw usedNamesResult.error;
    const usedNames = [
      ...new Set([
        ...baselineUsedCharacterNames,
        ...((usedNamesResult.data as string[] | null) ?? []).filter(Boolean),
      ]),
    ];

    stage = "story_planning";
    const models = createOpenAIContentModelsFromEnv(process.env);
    const rawPlan = await models.generator.generateJson({
      system: PLANNER_SYSTEM,
      prompt: plannerPrompt(input.characterPrompt, input.storyPrompt, usedNames),
      schemaName: "interactive_story_video_plan",
      schemaDescription:
        "One intro incident, a converging two-option emotion question, and a two-branch help resolution.",
      jsonSchema: aiVideoStoryPlanJsonSchema,
    });
    stage = "plan_validation";
    const planTemplate = parseAiVideoStoryPlanTemplate(rawPlan);

    stage = "name_reservation";
    const saved = await serverClient.rpc("create_ai_video_story_request", {
      target_actor_id: session.userId,
      target_character_prompt: input.characterPrompt,
      target_story_prompt: input.storyPrompt,
      target_candidate_names: planTemplate.nameCandidates,
      target_plan_template: planTemplate,
    });
    if (saved.error) throw saved.error;
    const stored = saved.data as StoredRequestResult;
    savedRequestId = stored.requestId;
    const plan = instantiateAiVideoStoryPlan(planTemplate, stored.characterName, stored.storyId);

    try {
      stage = "playback_graph";
      const graphResult = await session.client.rpc(
        "create_story_playback_graph",
        buildAiVideoPlaybackGraphRpcInput(plan),
      );
      if (graphResult.error) throw graphResult.error;
      const graphId = graphResult.data as string;
      stage = "media_queue";
      const jobIds = await enqueueStoryMedia(session.client, graphId, plan);
      stage = "graph_attachment";
      const attachResult = await serverClient.rpc("attach_ai_video_story_graph", {
        target_actor_id: session.userId,
        target_request_id: stored.requestId,
        target_graph_id: graphId,
      });
      if (attachResult.error) throw attachResult.error;
      return NextResponse.json(
        {
          requestId: stored.requestId,
          storyId: plan.storyId,
          graphId,
          status: "jobs_queued",
          characterName: plan.characterName,
          plan,
          jobIds,
        },
        { status: 201 },
      );
    } catch (error) {
      const failure = describeUnknownError(error, "Medya işleri oluşturulamadı.");
      await serverClient.rpc("update_ai_video_story_request_status", {
        target_actor_id: session.userId,
        target_request_id: stored.requestId,
        new_status: "failed",
        new_error: failure.message.slice(0, 1000),
      });
      throw error;
    }
  } catch (error) {
    const failure = describeUnknownError(error, "AI video hikâyesi oluşturulamadı.");
    if (savedRequestId && actorId) {
      await serverClient.rpc("update_ai_video_story_request_status", {
        target_actor_id: actorId,
        target_request_id: savedRequestId,
        new_status: "failed",
        new_error: failure.message.slice(0, 1000),
      });
    }
    return NextResponse.json({ error: failure.message, ...failure, stage }, { status: 400 });
  }
}
