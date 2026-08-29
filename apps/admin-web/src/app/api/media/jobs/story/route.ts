import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../lib/adminAuth";
import { createMediaJob, createStoryPlaybackGraph } from "../../../../../lib/media/jobStore";
import { planStoryPlayback } from "../../../../../lib/media/scenePlanner";
import { findStoryForMedia } from "../../../../../lib/media/storyLookup";
import type { DecisionAudioRenderManifest, MediaMode } from "../../../../../lib/media/types";

export const runtime = "nodejs";

interface CreatedJobSummary {
  jobId: string;
  clipId: string;
  mediaKind: "video" | "audio";
  audioRole?: "question" | "choice";
  choiceId?: string;
  status: string;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const { client } = await requireContentAdminSession(request, supabaseUrl, publishableKey);

    const body = (await request.json()) as {
      storyId?: unknown;
      provider?: unknown;
      mode?: unknown;
    };
    if (typeof body.storyId !== "string" || !body.storyId.trim()) {
      throw new Error("Geçersiz storyId.");
    }
    const provider =
      typeof body.provider === "string" && body.provider.trim()
        ? body.provider.trim()
        : "openmontage";
    const mode: MediaMode = body.mode === "static_image" ? "static_image" : "local_animation";

    const { story, assets } = await findStoryForMedia(client, body.storyId.trim());
    // Scene Planner (Phase 2) -- this route creates jobs from its output, it
    // never re-derives or reinterprets story content itself.
    const plan = planStoryPlayback(story, { assetCatalog: assets });

    const graphId = await createStoryPlaybackGraph(client, plan.graph);
    const jobs: CreatedJobSummary[] = [];

    // Every job below goes through the SAME granular createMediaJob() used
    // by POST /api/media/jobs -- this route does not implement a second job
    // creation path, only orchestrates calls to the existing primitive.
    for (const clip of plan.graph.clips) {
      if (clip.kind === "decision") continue;
      const scene = plan.scenes.find((candidate) => candidate.sceneId === clip.id);
      if (!scene) throw new Error(`Sahne bulunamadı: ${clip.id}`);
      const job = await createMediaJob(client, {
        storyId: story.id,
        sceneId: clip.id,
        provider,
        mode,
        renderManifest: { scene, mode, aspectRatio: "4:5" },
        graphId,
        mediaKind: "video",
      });
      jobs.push({ jobId: job.id, clipId: clip.id, mediaKind: "video", status: job.status });
    }

    for (const clip of plan.graph.clips) {
      if (clip.kind !== "decision") continue;

      const questionManifest: DecisionAudioRenderManifest = {
        kind: "decision_audio",
        text: clip.choice.question,
        decisionClipId: clip.id,
        audioRole: "question",
      };
      const questionJob = await createMediaJob(client, {
        storyId: story.id,
        sceneId: clip.id,
        provider,
        mode,
        renderManifest: questionManifest,
        graphId,
        mediaKind: "audio",
        audioRole: "question",
      });
      jobs.push({
        jobId: questionJob.id,
        clipId: clip.id,
        mediaKind: "audio",
        audioRole: "question",
        status: questionJob.status,
      });

      for (const option of clip.choice.options) {
        const optionManifest: DecisionAudioRenderManifest = {
          kind: "decision_audio",
          text: option.label,
          decisionClipId: clip.id,
          audioRole: "choice",
          choiceId: option.id,
        };
        const optionJob = await createMediaJob(client, {
          storyId: story.id,
          sceneId: clip.id,
          provider,
          mode,
          renderManifest: optionManifest,
          graphId,
          mediaKind: "audio",
          audioRole: "choice",
          choiceId: option.id,
        });
        jobs.push({
          jobId: optionJob.id,
          clipId: clip.id,
          mediaKind: "audio",
          audioRole: "choice",
          choiceId: option.id,
          status: optionJob.status,
        });
      }
    }

    return NextResponse.json({ graphId, jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Graph/iş oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
