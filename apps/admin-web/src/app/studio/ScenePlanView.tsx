"use client";

import type { StoryPlaybackGraph } from "@adaptive/media-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { SceneGenerationSpec } from "../../lib/media/types";
import { buildScenePlanCards } from "./pipeline";

export interface ScenePlan {
  graph: StoryPlaybackGraph;
  scenes: SceneGenerationSpec[];
}

/** Read-only preview of Phase 2's planStoryPlayback() output, fetched from
 * the new preview-only endpoint (POST /api/media/jobs/story/plan) --
 * nothing is persisted by loading this view. Renders the graph's own
 * clips/choice/nextClipId directly; this component invents no branching
 * of its own. */
export function ScenePlanView({
  supabase,
  storyId,
  onPlanLoaded,
}: {
  supabase: SupabaseClient;
  storyId: string;
  onPlanLoaded: (plan: ScenePlan) => void;
}) {
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Yönetici oturumu bulunamadı.");
      const response = await fetch("/api/media/jobs/story/plan", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const body = (await response.json()) as
        | ScenePlan
        | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "Sahne planı alınamadı.");
      }
      setPlan(body);
      onPlanLoaded(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Sahne planı alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [supabase, storyId, onPlanLoaded]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  if (loading) return <p className="generation-help">Sahne planı hazırlanıyor…</p>;
  if (error) return <p className="alert">{error}</p>;
  if (!plan) return null;

  const narrationByClipId = Object.fromEntries(
    plan.scenes.map((scene) => [scene.sceneId, scene.narration]),
  );
  const cards = buildScenePlanCards(plan.graph, narrationByClipId);

  return (
    <section className="scene-plan-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAHNE / DAL PLANI</p>
          <h2>Hikâye nasıl akacak</h2>
        </div>
      </div>
      <div className="scene-plan-cards">
        {cards.map((card) => (
          <article className="scene-plan-card" key={card.clipId}>
            <p className="scene-plan-role">{card.role}</p>
            {card.narration ? <p>{card.narration}</p> : null}
            {card.kind === "decision" ? (
              <div className="scene-plan-decision">
                <p className="scene-plan-question">Soru: “{card.question}”</p>
                <ul>
                  {card.options?.map((option) => (
                    <li key={option.id}>
                      {option.label} → <code>{option.nextClipId}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <small>{card.clipId}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
