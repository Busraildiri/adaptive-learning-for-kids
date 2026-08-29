/**
 * Pure derivation logic for the Content Production Studio. Deliberately
 * framework-free (no React) so every rule here is unit-testable without
 * rendering a component: status labels, readiness gating, job/graph
 * merging, and the overall pipeline stage are all computed from backend
 * reads, never stored as independent frontend truth (Phase 5 Decision:
 * "frontend pipeline stage persisted ayrı bir truth olmasın").
 */
import type { PlaybackClip, StoryPlaybackGraph } from "@adaptive/media-schema";
import type { MediaJob, MediaJobStatus, StoryMediaReadiness } from "../../lib/media/types";
import type { ReviewStatus } from "../../lib/reviewQueue";

export type StudioStage =
  | "idle"
  | "generating_story"
  | "awaiting_story_approval"
  | "story_rejected"
  | "story_approved"
  | "planning"
  | "ready_for_media"
  | "generating_media"
  | "media_partial"
  | "media_ready"
  | "ready_for_publish";

const JOB_STATUS_LABELS: Record<MediaJobStatus, string> = {
  queued: "Bekliyor",
  generating_audio: "Bekliyor",
  planning_scenes: "Bekliyor",
  generating_visuals: "Bekliyor",
  rendering: "Üretiliyor",
  uploading: "Yükleniyor",
  ready: "Hazır",
  failed: "Hata",
};

/** Honest 4-stage mapping -- no invented fine-grained progress animation
 * beyond what the backend actually reports. */
export function mapJobStatusLabel(status: MediaJobStatus): string {
  return JOB_STATUS_LABELS[status] ?? status;
}

export function isJobTerminal(status: MediaJobStatus): boolean {
  return status === "ready" || status === "failed";
}

/** Presentation-only label. Never invents branching -- the actual topology
 * (nextClipId / choice.options) always comes straight from the existing
 * StoryPlaybackGraph, this only names a card. */
export function deriveClipRole(clip: PlaybackClip, index: number): string {
  if (clip.kind === "decision") return "Karar";
  if (clip.kind === "ending") return "Son";
  return index === 0 ? "Giriş" : "Sahne";
}

export interface ScenePlanCardOption {
  id: string;
  label: string;
  nextClipId: string;
}

export interface ScenePlanCard {
  clipId: string;
  role: string;
  narration?: string;
  kind: PlaybackClip["kind"];
  question?: string;
  options?: ScenePlanCardOption[];
  nextClipId?: string;
}

/** Renders the existing graph's clips (already in narrative authoring
 * order from planStoryPlayback) into human-readable cards. Reads
 * clip.choice.options / clip.nextClipId directly -- no second graph model. */
export function buildScenePlanCards(
  graph: Pick<StoryPlaybackGraph, "clips">,
  narrationByClipId: Record<string, string> = {},
): ScenePlanCard[] {
  return graph.clips.map((clip, index) => ({
    clipId: clip.id,
    role: deriveClipRole(clip, index),
    narration: narrationByClipId[clip.id],
    kind: clip.kind,
    question: clip.kind === "decision" ? clip.choice.question : undefined,
    options: clip.kind === "decision" ? clip.choice.options : undefined,
    nextClipId: clip.kind === "linear" ? clip.nextClipId : undefined,
  }));
}

export interface MediaCardModel {
  key: string;
  label: string;
  job?: MediaJob;
}

export interface MediaCardGroups {
  videoCards: MediaCardModel[];
  audioCards: MediaCardModel[];
}

/** The core "1 renderable asset = 1 card" merge: walks the graph's clips
 * (topology) and matches each one against the job list (render status) by
 * sceneId/mediaKind/audioRole/choiceId. A card with no matching job yet
 * (job undefined) is presentationally "not started" -- this never happens
 * once Generate Media has actually run, since that call creates one job
 * per clip/audio asset up front. */
export function groupJobsByRole(
  clips: PlaybackClip[],
  jobs: MediaJob[],
  narrationByClipId: Record<string, string> = {},
): MediaCardGroups {
  const videoCards: MediaCardModel[] = clips
    .filter((clip) => clip.kind !== "decision")
    .map((clip, index) => ({
      key: clip.id,
      label: narrationByClipId[clip.id] ?? `${deriveClipRole(clip, index)} · ${clip.id}`,
      job: jobs.find((job) => job.mediaKind === "video" && job.sceneId === clip.id),
    }));

  const decisionClips = clips.filter(
    (clip): clip is Extract<PlaybackClip, { kind: "decision" }> => clip.kind === "decision",
  );

  const audioCards: MediaCardModel[] = decisionClips.flatMap((clip) => [
    {
      key: `${clip.id}-question`,
      label: `Soru: "${clip.choice.question}"`,
      job: jobs.find(
        (job) =>
          job.mediaKind === "audio" && job.audioRole === "question" && job.sceneId === clip.id,
      ),
    },
    ...clip.choice.options.map((option) => ({
      key: `${clip.id}-${option.id}`,
      label: `Seçenek: "${option.label}"`,
      job: jobs.find(
        (job) =>
          job.mediaKind === "audio" &&
          job.audioRole === "choice" &&
          job.sceneId === clip.id &&
          job.choiceId === option.id,
      ),
    })),
  ]);

  return { videoCards, audioCards };
}

/** Backend-derived-only readiness gate -- never recomputed independently
 * of get_story_media_readiness's own counts. */
export function isReadinessComplete(readiness: StoryMediaReadiness | undefined): boolean {
  if (!readiness) return false;
  return (
    readiness.totalClips > 0 &&
    readiness.readyClips === readiness.totalClips &&
    readiness.failedClips === 0 &&
    readiness.pendingClips === 0 &&
    readiness.readyChoiceAudio === readiness.totalChoiceAudio &&
    readiness.failedChoiceAudio === 0 &&
    readiness.pendingChoiceAudio === 0
  );
}

export interface ReadinessBanner {
  kind: "not_started" | "in_progress" | "partial_failure" | "ready_for_publish";
  label: string;
}

export function deriveReadinessBanner(
  readiness: StoryMediaReadiness | undefined,
  storyApproved: boolean,
): ReadinessBanner {
  if (!readiness) return { kind: "not_started", label: "Üretim henüz başlamadı." };
  const failedCount = readiness.failedClips + readiness.failedChoiceAudio;
  if (failedCount > 0) {
    return { kind: "partial_failure", label: `Kısmi hazır — ${failedCount} varlık başarısız.` };
  }
  if (storyApproved && isReadinessComplete(readiness)) {
    return { kind: "ready_for_publish", label: "Yayına hazır." };
  }
  const totalReady = readiness.readyClips + readiness.readyChoiceAudio;
  const total = readiness.totalClips + readiness.totalChoiceAudio;
  return { kind: "in_progress", label: `Üretiliyor… ${totalReady}/${total} hazır.` };
}

export interface StudioStageInput {
  isGeneratingStory: boolean;
  reviewStatus?: ReviewStatus;
  isLoadingPlan: boolean;
  hasScenePlan: boolean;
  graphId?: string;
  jobs?: MediaJob[];
  readiness?: StoryMediaReadiness;
}

/** The single place the Studio's pipeline stage is computed. Every input is
 * a backend read (or a local in-flight flag) -- nothing here is itself
 * persisted, so a page refresh that re-fetches the same backend state
 * recomputes the same stage. */
export function deriveStudioStage(input: StudioStageInput): StudioStage {
  if (input.isGeneratingStory) return "generating_story";
  if (!input.reviewStatus) return "idle";
  if (input.reviewStatus === "pending") return "awaiting_story_approval";
  if (input.reviewStatus === "rejected" || input.reviewStatus === "expired") {
    return "story_rejected";
  }

  // approved from here on
  if (!input.graphId) {
    if (input.isLoadingPlan) return "planning";
    return input.hasScenePlan ? "ready_for_media" : "story_approved";
  }

  const jobs = input.jobs ?? [];
  const allTerminal = jobs.length > 0 && jobs.every((job) => isJobTerminal(job.status));
  if (!allTerminal) return "generating_media";

  const anyFailed = jobs.some((job) => job.status === "failed");
  if (anyFailed) return "media_partial";

  return isReadinessComplete(input.readiness) ? "ready_for_publish" : "media_ready";
}
