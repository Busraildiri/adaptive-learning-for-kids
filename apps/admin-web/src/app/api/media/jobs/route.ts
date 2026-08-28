import { contentVersionSchema, type Story } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../lib/adminAuth";
import { createMediaJob, listMediaJobs } from "../../../../lib/media/jobStore";
import { buildSceneGenerationSpecs } from "../../../../lib/media/schemaAdapter";
import type { MediaMode } from "../../../../lib/media/types";

export const runtime = "nodejs";

const MEDIA_MODES: MediaMode[] = ["local_animation", "static_image"];

interface RawMediaJobRequest {
  storyId: string;
  sceneId?: string;
  provider: string;
  mode: MediaMode;
}

function parseRawMediaJobRequest(value: unknown): RawMediaJobRequest {
  if (!value || typeof value !== "object") throw new Error("Geçersiz iş isteği.");
  const input = value as Record<string, unknown>;
  const { storyId, provider, mode, sceneId } = input;
  if (typeof storyId !== "string" || !storyId.trim()) throw new Error("Geçersiz storyId.");
  if (typeof provider !== "string" || !provider.trim()) throw new Error("Geçersiz provider.");
  if (typeof mode !== "string" || !MEDIA_MODES.includes(mode as MediaMode)) {
    throw new Error("Geçersiz mode.");
  }
  if (sceneId !== undefined && typeof sceneId !== "string") throw new Error("Geçersiz sceneId.");
  return {
    storyId: storyId.trim(),
    provider: provider.trim(),
    mode: mode as MediaMode,
    sceneId: sceneId?.trim(),
  };
}

function findStory(storyId: string): Story {
  const content = contentVersionSchema.parse(contentJson);
  const story = content.stories.find((candidate) => candidate.id === storyId);
  if (!story) throw new Error("Hikaye bulunamadı.");
  return story;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const { client } = await requireContentAdminSession(request, supabaseUrl, publishableKey);

    const raw = parseRawMediaJobRequest(await request.json());
    const story = findStory(raw.storyId);
    const specs = buildSceneGenerationSpecs(story);
    const scene = raw.sceneId
      ? specs.find((candidate) => candidate.sceneId === raw.sceneId)
      : specs[0];
    if (!scene) throw new Error("Sahne bulunamadı.");

    const job = await createMediaJob(client, {
      storyId: raw.storyId,
      sceneId: scene.sceneId,
      provider: raw.provider,
      mode: raw.mode,
      renderManifest: { scene, mode: raw.mode, aspectRatio: "4:5" },
    });
    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "İş oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const { client } = await requireContentAdminSession(request, supabaseUrl, publishableKey);
    return NextResponse.json({ jobs: await listMediaJobs(client) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşler listelenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
