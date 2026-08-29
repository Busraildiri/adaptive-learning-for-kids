"use client";

import type { PlaybackClip } from "@adaptive/media-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { getLatestPublishedExperience, getStoryPlaybackGraph } from "../../lib/media/jobStore";
import type { ReviewItem } from "../../lib/reviewQueue";
import { useMediaJobsPolling } from "./hooks/useMediaJobsPolling";
import { MediaProductionPanel } from "./MediaProductionPanel";
import { deriveStudioStage } from "./pipeline";
import { type PublicationState, ProductionReadiness } from "./ProductionReadiness";
import { type ScenePlan, ScenePlanView } from "./ScenePlanView";
import { StoryCreationForm, type StoryGenerationResult } from "./StoryCreationForm";
import { StoryReviewCard } from "./StoryReviewCard";

/** Content Production Studio -- the story-first replacement for the old
 * asset-first GenerationPanel. Owns the pipeline: Create -> Review ->
 * Approve -> Scene Plan -> Generate Media -> Media Production -> Preview ->
 * Ready for Publish. The current stage is always derived (deriveStudioStage)
 * from backend reads, never stored as independent frontend truth -- a page
 * refresh recomputes the same stage from the same storyId/graphId. */
export function ContentProductionStudio({ supabase }: { supabase: SupabaseClient }) {
  return (
    <Suspense fallback={<p className="generation-help">Stüdyo yükleniyor…</p>}>
      <StudioInner supabase={supabase} />
    </Suspense>
  );
}

function StudioInner({ supabase }: { supabase: SupabaseClient }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL is the only persisted identifier -- large objects (story/graph/job
  // bodies) are never written to the query string, localStorage, or
  // sessionStorage. A refresh re-fetches everything below from the backend
  // using only these two ids (Phase 5 Decision 2).
  const [storyId, setStoryId] = useState<string | undefined>(searchParams.get("storyId") ?? undefined);
  const [graphId, setGraphId] = useState<string | undefined>(searchParams.get("graphId") ?? undefined);

  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [reviewItem, setReviewItem] = useState<ReviewItem | null | undefined>(undefined);
  const [approving, setApproving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [scenePlan, setScenePlan] = useState<ScenePlan | null>(null);
  const [resumedClips, setResumedClips] = useState<PlaybackClip[] | null>(null);
  const [startingMedia, setStartingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [publication, setPublication] = useState<PublicationState>({ status: "idle" });

  const syncUrl = useCallback(
    (next: { storyId?: string; graphId?: string }) => {
      const params = new URLSearchParams();
      if (next.storyId) params.set("storyId", next.storyId);
      if (next.graphId) params.set("graphId", next.graphId);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname],
  );

  const loadReviewItem = useCallback(async () => {
    if (!storyId) return;
    const { data, error } = await supabase.rpc("list_content_review_queue");
    if (error) {
      setReviewError(error.message);
      return;
    }
    const items = (data ?? []) as ReviewItem[];
    setReviewItem(items.find((candidate) => candidate.story_id === storyId) ?? null);
  }, [supabase, storyId]);

  useEffect(() => {
    void loadReviewItem();
  }, [loadReviewItem]);

  // Resume: a graphId in the URL but no scenePlan in memory means this is a
  // fresh page load, not a continuation of the Generate Media click below --
  // topology comes from the persisted graph instead.
  useEffect(() => {
    if (!graphId || scenePlan) return;
    let cancelled = false;
    void getStoryPlaybackGraph(supabase, graphId).then((graph) => {
      if (!cancelled) setResumedClips(graph.clips.map((entry) => entry.clip));
    });
    return () => {
      cancelled = true;
    };
  }, [graphId, scenePlan, supabase]);

  const { jobs, readiness, refresh: refreshJobs } = useMediaJobsPolling(supabase, graphId);

  // Resume: if this story already has a finalized publication, reflect
  // that on load rather than requiring another click -- read from the
  // same authenticated-readable view mobile itself reads, never
  // re-derived from private production state.
  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    void getLatestPublishedExperience(supabase, storyId).then((latest) => {
      if (cancelled || !latest) return;
      setPublication({ status: "published", publishedVersion: latest.publishedVersion, publishedAt: latest.publishedAt });
    });
    return () => {
      cancelled = true;
    };
  }, [storyId, supabase]);

  const stage = deriveStudioStage({
    isGeneratingStory,
    reviewStatus: reviewItem?.status,
    isLoadingPlan: false,
    hasScenePlan: Boolean(scenePlan),
    graphId,
    jobs,
    readiness,
  });

  function handleGenerated(result: StoryGenerationResult) {
    if (result.status === "not_publishable") {
      setGenerationError(
        `Taslak yayınlanmadı: ${(result.rejectionReasons ?? []).join(", ")}${result.technicalError ? ` — ${result.technicalError}` : ""}`,
      );
      return;
    }
    setGenerationError(null);
    const newStoryId = result.storyId;
    if (!newStoryId) return;
    setStoryId(newStoryId);
    setReviewItem(undefined);
    syncUrl({ storyId: newStoryId });
  }

  async function approve() {
    if (!reviewItem) return;
    setApproving(true);
    setReviewError(null);
    const { error } = await supabase.rpc("decide_content_review", {
      target_queue_id: reviewItem.id,
      requested_decision: "approved",
      decision_reason: "admin_approved",
    });
    if (error) {
      setReviewError(error.message);
      setApproving(false);
      return;
    }
    setApproving(false);
    await loadReviewItem();
  }

  async function generateMedia() {
    if (!storyId || !scenePlan) return;
    setStartingMedia(true);
    setMediaError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Yönetici oturumu bulunamadı.");
      const response = await fetch("/api/media/jobs/story", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const body = (await response.json()) as { graphId?: string; error?: string };
      if (!response.ok || !body.graphId) throw new Error(body.error ?? "Medya üretimi başlatılamadı.");
      setGraphId(body.graphId);
      syncUrl({ storyId, graphId: body.graphId });
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : "Medya üretimi başlatılamadı.");
    } finally {
      setStartingMedia(false);
    }
  }

  async function publish() {
    if (!graphId) return;
    setPublication({ status: "publishing" });
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Yönetici oturumu bulunamadı.");
      const response = await fetch(`/api/media/graphs/${graphId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        status?: string;
        publishedVersion?: number;
        publishedAt?: string;
        error?: string;
      };
      if (!response.ok || body.status === "failed") {
        setPublication({ status: "failed", error: body.error ?? "Yayınlama başarısız." });
        return;
      }
      // The short-circuit ("already published") response only carries
      // publicationId, not publishedVersion/publishedAt -- refresh from
      // the same view mobile reads rather than guessing those fields.
      const latest = await getLatestPublishedExperience(supabase, storyId ?? "");
      setPublication({
        status: "published",
        publishedVersion: body.publishedVersion ?? latest?.publishedVersion,
        publishedAt: body.publishedAt ?? latest?.publishedAt,
      });
    } catch (error) {
      setPublication({ status: "failed", error: error instanceof Error ? error.message : "Yayınlama başarısız." });
    }
  }

  function startOver() {
    setStoryId(undefined);
    setGraphId(undefined);
    setReviewItem(undefined);
    setScenePlan(null);
    setResumedClips(null);
    setGenerationError(null);
    setPublication({ status: "idle" });
    syncUrl({});
  }

  const narrationByClipId = Object.fromEntries(
    (scenePlan?.scenes ?? []).map((scene) => [scene.sceneId, scene.narration]),
  );
  const clips = scenePlan?.graph.clips ?? resumedClips ?? [];

  return (
    <div className="content-production-studio">
      {!storyId ? (
        <StoryCreationForm
          busy={isGeneratingStory}
          onBusyChange={setIsGeneratingStory}
          onGenerated={handleGenerated}
          supabase={supabase}
        />
      ) : (
        <button className="quiet" onClick={startOver} type="button">
          ← Yeni Hikâye Oluştur
        </button>
      )}
      {generationError ? <p className="alert">{generationError}</p> : null}

      {storyId && reviewItem === undefined ? (
        <p className="generation-help">İnceleme kaydı yükleniyor…</p>
      ) : null}
      {storyId && reviewItem === null ? (
        <p className="alert">Bu hikâye için inceleme kaydı bulunamadı.</p>
      ) : null}
      {storyId && reviewItem && reviewItem.status === "pending" ? (
        <StoryReviewCard busy={approving} error={reviewError} item={reviewItem} onApprove={() => void approve()} />
      ) : null}
      {storyId && reviewItem && (reviewItem.status === "rejected" || reviewItem.status === "expired") ? (
        <p className="alert">
          Bu hikâye taslağı artık kullanılamıyor ({reviewItem.status === "rejected" ? "reddedildi" : "süresi doldu"}).
          Yeni bir hikâye üretmen gerekiyor.
        </p>
      ) : null}

      {storyId && reviewItem?.status === "approved" && !graphId ? (
        <>
          <ScenePlanView onPlanLoaded={setScenePlan} storyId={storyId} supabase={supabase} />
          {scenePlan ? (
            <div className="decision-bar">
              <button className="primary" disabled={startingMedia} onClick={() => void generateMedia()} type="button">
                {startingMedia ? "Medya üretimi başlatılıyor…" : "Medya Üret"}
              </button>
            </div>
          ) : null}
          {mediaError ? <p className="alert">{mediaError}</p> : null}
        </>
      ) : null}

      {graphId ? (
        <>
          <ProductionReadiness
            onPublish={() => void publish()}
            publication={publication}
            readiness={readiness}
            storyApproved={reviewItem?.status === "approved"}
          />
          <MediaProductionPanel
            clips={clips}
            jobs={jobs}
            narrationByClipId={narrationByClipId}
            onJobsChanged={() => void refreshJobs()}
            supabase={supabase}
          />
        </>
      ) : null}
      {stage === "idle" && !storyId ? null : (
        <p className="generation-help studio-stage-indicator">Aşama: {stage}</p>
      )}
    </div>
  );
}
