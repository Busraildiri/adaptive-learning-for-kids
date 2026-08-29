import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../lib/adminAuth";
import { describeUnknownError } from "../../../../../lib/apiError";

export const runtime = "nodejs";

interface StoredAiVideoRequest {
  requestId: string;
  storyId: string;
  characterName: string;
  status: "planned" | "jobs_queued" | "rendering" | "ready" | "failed";
  error?: string | null;
  graphId?: string | null;
  plan: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ReadinessRow {
  total_clips: number;
  ready_clips: number;
  failed_clips: number;
  pending_clips: number;
  total_choice_audio: number;
  ready_choice_audio: number;
  failed_choice_audio: number;
  pending_choice_audio: number;
}

interface MediaJobRow {
  id: string;
  graph_id: string | null;
  scene_id: string | null;
  media_kind: "video" | "audio";
  status: string;
  error: string | null;
}

interface DeletedAiVideoStory {
  requestId: string;
  storyId: string;
  sourcePaths: string[];
  publishedPaths: string[];
}

function serviceClient(): SupabaseClient {
  return createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function derivedStatus(
  stored: StoredAiVideoRequest,
  readiness: ReadinessRow | null,
  jobs: MediaJobRow[],
): StoredAiVideoRequest["status"] {
  if (stored.status === "failed" || jobs.some((job) => job.status === "failed")) return "failed";
  if (!readiness) return stored.status;
  const allVideoReady =
    readiness.total_clips > 0 && readiness.ready_clips === readiness.total_clips;
  const allAudioReady =
    readiness.total_choice_audio > 0 &&
    readiness.ready_choice_audio === readiness.total_choice_audio;
  if (allVideoReady && allAudioReady) return "ready";
  if (jobs.some((job) => ["rendering", "uploading"].includes(job.status))) return "rendering";
  return "jobs_queued";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  let stage = "status_session";
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    const session = await requireContentAdminSession(request, supabaseUrl, publishableKey);
    const serverClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { requestId } = await params;
    if (!/^[0-9a-f-]{36}$/iu.test(requestId)) throw new Error("Geçersiz üretim isteği kimliği.");

    stage = "request_status";
    const storedResult = await serverClient.rpc("get_ai_video_story_request", {
      target_actor_id: session.userId,
      target_request_id: requestId,
    });
    if (storedResult.error) throw storedResult.error;
    const stored = storedResult.data as StoredAiVideoRequest;

    let readiness: ReadinessRow | null = null;
    let jobs: MediaJobRow[] = [];
    if (stored.graphId) {
      stage = "media_status";
      const [readinessResult, jobsResult] = await Promise.all([
        session.client.rpc("get_story_media_readiness", { target_graph_id: stored.graphId }),
        session.client.rpc("list_media_jobs"),
      ]);
      if (readinessResult.error) throw readinessResult.error;
      if (jobsResult.error) throw jobsResult.error;
      readiness = ((readinessResult.data as ReadinessRow[] | null) ?? [])[0] ?? null;
      jobs = ((jobsResult.data as MediaJobRow[] | null) ?? []).filter(
        (job) => job.graph_id === stored.graphId,
      );
    }

    const status = derivedStatus(stored, readiness, jobs);
    const failedJob = jobs.find((job) => job.status === "failed");
    const error = stored.error ?? failedJob?.error ?? null;
    if (status !== stored.status) {
      stage = "status_update";
      const updateResult = await serverClient.rpc("update_ai_video_story_request_status", {
        target_actor_id: session.userId,
        target_request_id: requestId,
        new_status: status,
        new_error: error,
      });
      if (updateResult.error) throw updateResult.error;
    }

    return NextResponse.json({ ...stored, status, error, readiness, jobs });
  } catch (error) {
    const failure = describeUnknownError(error, "Üretim durumu alınamadı.");
    return NextResponse.json({ error: failure.message, ...failure, stage }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  let stage = "edit_session";
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const session = await requireContentAdminSession(request, supabaseUrl, publishableKey);
    const { requestId } = await params;
    if (!/^[0-9a-f-]{36}$/iu.test(requestId)) throw new Error("Geçersiz üretim isteği kimliği.");

    stage = "edit_input";
    const body = (await request.json()) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 1 || title.length > 120) {
      throw new Error("Başlık 1-120 karakter olmalı.");
    }

    stage = "edit_title";
    const serverClient = serviceClient();
    const updateResult = await serverClient.rpc("update_ai_video_story_title", {
      target_actor_id: session.userId,
      target_request_id: requestId,
      new_title: title,
    });
    if (updateResult.error) throw updateResult.error;

    return NextResponse.json({ requestId, plan: updateResult.data });
  } catch (error) {
    const failure = describeUnknownError(error, "Hikâye başlığı güncellenemedi.");
    return NextResponse.json({ error: failure.message, ...failure, stage }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  let stage = "delete_session";
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const session = await requireContentAdminSession(request, supabaseUrl, publishableKey);
    const { requestId } = await params;
    if (!/^[0-9a-f-]{36}$/iu.test(requestId)) throw new Error("Geçersiz üretim isteği kimliği.");
    const force = new URL(request.url).searchParams.get("force") === "true";

    stage = "delete_database";
    const serverClient = serviceClient();
    const deletedResult = await serverClient.rpc("delete_ai_video_story_request", {
      target_request_id: requestId,
      target_actor_id: session.userId,
      force,
    });
    if (deletedResult.error) throw deletedResult.error;
    const deleted = deletedResult.data as DeletedAiVideoStory;

    stage = "delete_storage";
    const warnings: string[] = [];
    if (deleted.sourcePaths.length > 0) {
      const removed = await serverClient.storage.from("media-renders").remove(deleted.sourcePaths);
      if (removed.error) warnings.push(removed.error.message);
    }
    if (deleted.publishedPaths.length > 0) {
      const removed = await serverClient.storage
        .from("published-story-media")
        .remove(deleted.publishedPaths);
      if (removed.error) warnings.push(removed.error.message);
    }

    return NextResponse.json({ ...deleted, deleted: true, warnings });
  } catch (error) {
    const failure = describeUnknownError(error, "AI video hikâyesi silinemedi.");
    return NextResponse.json({ error: failure.message, ...failure, stage }, { status: 400 });
  }
}
