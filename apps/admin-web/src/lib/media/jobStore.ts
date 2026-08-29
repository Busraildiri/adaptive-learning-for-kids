import {
  type PublishedStoryExperience,
  publishedStoryExperienceSchema,
  type StoryPlaybackGraph,
  type StoryPlaybackGraphWithState,
} from "@adaptive/media-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AudioRole,
  CreateMediaJobInput,
  DecisionAudioRenderManifest,
  MediaGenerationInput,
  MediaJob,
  MediaJobStatus,
  MediaKind,
  MediaMode,
  StoryMediaReadiness,
} from "./types";

interface MediaJobRow {
  id: string;
  story_id: string;
  scene_id: string | null;
  graph_id: string | null;
  media_kind: "video" | "audio";
  audio_role: "question" | "choice" | null;
  choice_id: string | null;
  storage_path: string | null;
  render_id: string | null;
  provider: string;
  mode: string;
  render_manifest: MediaGenerationInput | DecisionAudioRenderManifest;
  graph_id: string | null;
  media_kind: string;
  audio_role: string | null;
  choice_id: string | null;
  storage_path: string | null;
  render_id: string | null;
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
    graphId: row.graph_id ?? undefined,
    mediaKind: row.media_kind,
    audioRole: row.audio_role ?? undefined,
    choiceId: row.choice_id ?? undefined,
    storagePath: row.storage_path ?? undefined,
    renderId: row.render_id ?? undefined,
    provider: row.provider,
    mode: row.mode as MediaMode,
    renderManifest: row.render_manifest,
    graphId: row.graph_id ?? undefined,
    mediaKind: row.media_kind as MediaKind,
    audioRole: (row.audio_role as AudioRole | null) ?? undefined,
    choiceId: row.choice_id ?? undefined,
    storagePath: row.storage_path ?? undefined,
    renderId: row.render_id ?? undefined,
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
    target_graph_id: input.graphId ?? null,
    target_media_kind: input.mediaKind ?? "video",
    target_audio_role: input.audioRole ?? null,
    target_choice_id: input.choiceId ?? null,
  });
  if (createError) throw new Error(createError.message);
  const job = await getMediaJob(client, jobId as string);
  if (!job) throw new Error("Oluşturulan iş bulunamadı.");
  return job;
}

/** Persists a Phase 2 StoryPlaybackPlan.graph via the Phase 1 RPC. Returns
 * the graph's real DB-assigned id (the plan's own `id` is only provisional). */
export async function createStoryPlaybackGraph(
  client: SupabaseClient,
  graph: StoryPlaybackGraph,
): Promise<string> {
  const { data, error } = await client.rpc("create_story_playback_graph", {
    target_story_id: graph.storyId,
    target_story_version: graph.storyVersion,
    target_source_request_id: graph.sourceRequestId ?? null,
    target_start_clip_id: graph.startClipId,
    target_clips: graph.clips,
  });
  if (error) throw new Error(error.message);
  return data as string;
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

/** Pure -- the server-side half of Phase 5's "additional decision" on graph
 * job polling: rather than a new SQL-level filtered RPC, the existing
 * authorized listMediaJobs() result is filtered here, server-side, before
 * it ever reaches the browser. Exported standalone so the filtering logic
 * itself is unit-testable without a Supabase client. */
export function filterJobsByGraph(jobs: MediaJob[], graphId: string): MediaJob[] {
  return jobs.filter((job) => job.graphId === graphId);
}

export async function listMediaJobsForGraph(
  client: SupabaseClient,
  graphId: string,
): Promise<MediaJob[]> {
  return filterJobsByGraph(await listMediaJobs(client), graphId);
}

/** Read-only wrapper around Phase 1's get_story_playback_graph RPC -- no
 * new backend logic, this RPC already existed with no TS caller. */
export async function getStoryPlaybackGraph(
  client: SupabaseClient,
  graphId: string,
): Promise<StoryPlaybackGraphWithState> {
  const { data, error } = await client.rpc("get_story_playback_graph", {
    target_graph_id: graphId,
  });
  if (error) throw new Error(error.message);
  return data as StoryPlaybackGraphWithState;
}

interface StoryMediaReadinessRow {
  total_clips: number;
  ready_clips: number;
  failed_clips: number;
  pending_clips: number;
  total_choice_audio: number;
  ready_choice_audio: number;
  failed_choice_audio: number;
  pending_choice_audio: number;
}

/** Read-only wrapper around Phase 4's get_story_media_readiness RPC --
 * always re-derived server-side, never cached/stored by this function or
 * its caller. */
export async function getStoryMediaReadiness(
  client: SupabaseClient,
  graphId: string,
): Promise<StoryMediaReadiness> {
  const { data, error } = await client.rpc("get_story_media_readiness", {
    target_graph_id: graphId,
  });
  if (error) throw new Error(error.message);
  const row = (data as StoryMediaReadinessRow[] | null)?.[0];
  if (!row) throw new Error("Hazırlık bilgisi bulunamadı.");
  return {
    totalClips: row.total_clips,
    readyClips: row.ready_clips,
    failedClips: row.failed_clips,
    pendingClips: row.pending_clips,
    totalChoiceAudio: row.total_choice_audio,
    readyChoiceAudio: row.ready_choice_audio,
    failedChoiceAudio: row.failed_choice_audio,
    pendingChoiceAudio: row.pending_choice_audio,
  };
}

/** Read-write wrapper around Phase 4's retry_media_job RPC. Only accepts a
 * job whose status is already 'failed' (enforced server-side) -- same
 * immutable render_manifest, never a new render input. Regenerate (new
 * input/history) is explicitly out of Phase 5's scope. */
export async function retryMediaJob(client: SupabaseClient, jobId: string): Promise<void> {
  const { error } = await client.rpc("retry_media_job", { target_job_id: jobId });
  if (error) throw new Error(error.message);
}

// --- Phase 6: publication protocol (PREPARE / FAIL / FINALIZE). All three
// RPCs are service_role-only -- these wrappers are only ever called with a
// service-role client from the publish route, never from the browser.

export interface PublicationManifestEntry {
  kind: "video" | "audio";
  clipId?: string;
  decisionClipId?: string;
  audioRole?: "question" | "choice";
  choiceId?: string | null;
  renderId: string | null;
  sourcePath: string;
  destPath: string;
  durationMs: number;
}

export interface PreparePublicationResult {
  publicationId: string;
  status: "preparing" | "published" | "failed";
  fingerprint: string;
  copyManifest: PublicationManifestEntry[];
}

/** Stage 1 of the three-stage publish protocol -- DB-only. Verifies
 * approval/readiness/graph-contract, freezes the exact render snapshot,
 * and returns either an existing publication (same fingerprint --
 * idempotent short-circuit or a revived failed attempt) or a fresh
 * 'preparing' row plus the manifest the caller must copy before calling
 * finalizeStoryPublication. */
export async function prepareStoryPublication(
  client: SupabaseClient,
  graphId: string,
  actorId: string,
): Promise<PreparePublicationResult> {
  const { data, error } = await client.rpc("prepare_story_publication", {
    target_graph_id: graphId,
    actor_id: actorId,
  });
  if (error) throw new Error(error.message);
  return data as PreparePublicationResult;
}

/** Stage 2b (failure path) -- only ever transitions a 'preparing' row to
 * 'failed'; never touches an already-published row. */
export async function failStoryPublication(
  client: SupabaseClient,
  publicationId: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc("fail_story_publication", {
    target_publication_id: publicationId,
    actor_id: actorId,
    reason,
  });
  if (error) throw new Error(error.message);
}

export interface FinalizePublicationResult {
  publicationId: string;
  status: "published";
  publishedVersion: number;
  publishedAt: string;
  experience: PublishedStoryExperience;
}

/** Stage 3 -- verifies the caller's confirmed (post-copy) object paths
 * against the frozen manifest by set equality, then flips the publication
 * to 'published' and builds the mobile-facing payload. Re-validated here
 * with the shared Zod schema (not just trusted from the hand-built SQL
 * JSON) before returning it to the caller. */
export async function finalizeStoryPublication(
  client: SupabaseClient,
  publicationId: string,
  actorId: string,
  confirmedObjectPaths: string[],
): Promise<FinalizePublicationResult> {
  const { data, error } = await client.rpc("finalize_story_publication", {
    target_publication_id: publicationId,
    actor_id: actorId,
    confirmed_object_paths: confirmedObjectPaths,
  });
  if (error) throw new Error(error.message);
  const result = data as FinalizePublicationResult;
  const parsed = publishedStoryExperienceSchema.safeParse(result.experience);
  if (!parsed.success) {
    throw new Error(`Yayınlanan içerik beklenen şemaya uymuyor: ${parsed.error.issues[0]?.message ?? "bilinmeyen hata"}`);
  }
  return { ...result, experience: parsed.data };
}

/** Read-only: the same public.published_story_experiences view mobile
 * reads (authenticated-readable), used here only so the Studio can show
 * "Yayınlandı vN" after a page refresh without re-deriving it from
 * private production state. Returns undefined if nothing has been
 * published for this story yet. */
export async function getLatestPublishedExperience(
  client: SupabaseClient,
  storyId: string,
): Promise<{ publishedVersion: number; publishedAt: string } | undefined> {
  const { data, error } = await client
    .from("published_story_experiences")
    .select("published_version, published_at")
    .eq("story_id", storyId)
    .order("published_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return undefined;
  return { publishedVersion: data.published_version, publishedAt: data.published_at };
}
