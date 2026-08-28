import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateMediaJobInput,
  MediaGenerationInput,
  MediaJob,
  MediaJobStatus,
  MediaMode,
} from "./types";

interface MediaJobRow {
  id: string;
  story_id: string;
  scene_id: string | null;
  provider: string;
  mode: string;
  render_manifest: MediaGenerationInput;
  status: string;
  progress: number;
  asset_url: string | null;
  error: string | null;
  requested_by: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: MediaJobRow): MediaJob {
  return {
    id: row.id,
    storyId: row.story_id,
    sceneId: row.scene_id ?? undefined,
    provider: row.provider,
    mode: row.mode as MediaMode,
    renderManifest: row.render_manifest,
    status: row.status as MediaJobStatus,
    progress: row.progress,
    assetUrl: row.asset_url ?? undefined,
    error: row.error ?? undefined,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMediaJob(
  client: SupabaseClient,
  input: CreateMediaJobInput,
): Promise<MediaJob> {
  const { data: jobId, error: createError } = await client.rpc("create_media_job", {
    target_story_id: input.storyId,
    target_scene_id: input.sceneId ?? null,
    target_provider: input.provider,
    target_mode: input.mode,
    target_render_manifest: input.renderManifest,
  });
  if (createError) throw new Error(createError.message);
  const job = await getMediaJob(client, jobId as string);
  if (!job) throw new Error("Oluşturulan iş bulunamadı.");
  return job;
}

export async function getMediaJob(
  client: SupabaseClient,
  jobId: string,
): Promise<MediaJob | undefined> {
  const { data, error } = await client.rpc("get_media_job", { target_job_id: jobId });
  if (error) throw new Error(error.message);
  const row = (data as MediaJobRow[] | null)?.[0];
  return row ? mapRow(row) : undefined;
}

export async function listMediaJobs(client: SupabaseClient): Promise<MediaJob[]> {
  const { data, error } = await client.rpc("list_media_jobs");
  if (error) throw new Error(error.message);
  return ((data as MediaJobRow[] | null) ?? []).map(mapRow);
}
