"use client";

import { type AgeBand, contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useState } from "react";
import {
  AGE_BANDS,
  isAllowedSceneAsset,
  isUsableFlowAsset,
  themeConflictsWithAsset,
} from "../../lib/generation";
import { findStoryBlueprint, videoBranchingBlueprints } from "../../lib/storyBlueprints";

// Data-driven, not a hardcoded blueprint-id list -- only blueprints whose
// experienceType is "video_branching" are offered here. Legacy
// interactive_ui blueprints remain reachable through /api/generate and the
// legacy review workspace, just never through this form.
const studioBlueprints = videoBranchingBlueprints();
import { AdvancedAssetControls, type AdvancedAssetSelection } from "./AdvancedAssetControls";

const content = contentVersionSchema.parse(contentJson);

export interface StoryGenerationResult {
  requestId?: string;
  storyId?: string;
  status?: "published" | "queued_for_review" | "not_publishable";
  rejectionReasons?: string[];
  technicalError?: string;
  error?: string;
}

function defaultsForBlueprint(flowId: string): AdvancedAssetSelection & { ageBands: AgeBand[] } {
  const blueprint = findStoryBlueprint(flowId);
  const template = content.stories.find((story) => story.id === blueprint?.mechanicsSourceStoryId);
  const sceneAssets = content.assets.filter((asset) => template && isAllowedSceneAsset(asset, template));
  return {
    sceneAssetId:
      sceneAssets.find((asset) => asset.id === blueprint?.defaultSceneAssetId)?.id ??
      sceneAssets[0]?.id ??
      "",
    happyAssetId: template?.characterAssets.happyAssetId ?? "",
    sadAssetId: template?.characterAssets.sadAssetId ?? "",
    ageBands: template?.ageBands ?? ["2-4"],
  };
}

/** Primary Studio entry point. Story-first: theme + blueprint + age band are
 * the only fields the admin must look at. Scene/character assets are
 * defaulted from the blueprint's own template and only ever surfaced via
 * AdvancedAssetControls (collapsed, optional override) -- the old
 * asset-first happy path (pick assets, THEN generate) is gone.
 *
 * Phase 5 Decision 1: every submission is sent with sendToReview: true, so
 * every generated story lands in content_review_queue and requires an
 * explicit admin Approve before Scene Planning/media can start. This is a
 * call-site flag only -- /api/generate's content-agent/safety/audit logic
 * is untouched, and other legacy callers of that route are unaffected. */
export function StoryCreationForm({
  supabase,
  busy,
  onBusyChange,
  onGenerated,
}: {
  supabase: SupabaseClient;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onGenerated: (result: StoryGenerationResult) => void;
}) {
  const [flowId, setFlowId] = useState(studioBlueprints[0]?.id ?? "");
  const blueprint = findStoryBlueprint(flowId);
  const template = content.stories.find((story) => story.id === blueprint?.mechanicsSourceStoryId);
  const sceneAssets = content.assets.filter((asset) => template && isAllowedSceneAsset(asset, template));
  const flowAssets = content.assets.filter(isUsableFlowAsset);
  const emotions = [
    ...new Set(
      template?.steps
        .filter((step) => step.type === "emotion_choice")
        .flatMap((step) => step.choices.map((choice) => choice.emotion)) ?? [],
    ),
  ];

  const [theme, setTheme] = useState("");
  const [ageBands, setAgeBands] = useState<AgeBand[]>(defaultsForBlueprint(flowId).ageBands);
  const [assetSelection, setAssetSelection] = useState<AdvancedAssetSelection>(
    defaultsForBlueprint(flowId),
  );
  const [error, setError] = useState<string | null>(null);

  const toggleAgeBand = (ageBand: AgeBand, checked: boolean) => {
    setAgeBands((current) =>
      checked ? [...current, ageBand] : current.filter((value) => value !== ageBand),
    );
  };

  const selectedSceneAsset = sceneAssets.find((asset) => asset.id === assetSelection.sceneAssetId);

  function selectBlueprint(nextFlowId: string) {
    setFlowId(nextFlowId);
    const defaults = defaultsForBlueprint(nextFlowId);
    setAssetSelection(defaults);
    setAgeBands(defaults.ageBands);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedSceneAsset && themeConflictsWithAsset(theme, selectedSceneAsset)) {
      setError(
        `Tema bu görselle çelişiyor. Bu sahne için şu ifadelerden birini kullan: ${selectedSceneAsset.semantic?.allowedNarrativeTerms.join(", ")}.`,
      );
      return;
    }
    onBusyChange(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Yönetici oturumu bulunamadı.");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          flowId,
          theme,
          // "n/a" for templates with no emotion_choice step (the new
          // video_branching contract has none) -- /api/generate only
          // validates this against the template when it actually has
          // supported emotions, so the placeholder is inert there.
          targetEmotion: emotions[0] ?? "n/a",
          sceneAssetId: assetSelection.sceneAssetId,
          flowAssetIds: [assetSelection.happyAssetId, assetSelection.sadAssetId],
          ageBands,
          sendToReview: true,
        }),
      });
      const body = (await response.json()) as StoryGenerationResult;
      if (!response.ok) throw new Error(body.error ?? "Hikâye üretilemedi.");
      setTheme("");
      onGenerated(body);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Hikâye üretilemedi.");
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <section className="generation-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">İÇERİK ÜRETİM STÜDYOSU</p>
          <h2>Yeni hikâye oluştur</h2>
        </div>
        <span className="server-only-badge">Anahtar yalnızca sunucuda</span>
      </div>
      <p className="generation-help">
        Bir olay akışı ve tema seç. Karakter görselleri otomatik olarak dolduruldu; sahne
        görselini görmek veya değiştirmek istersen aşağıdaki gelişmiş bölümü aç.
      </p>
      <form className="generation-form" onSubmit={submit}>
        <label>
          Olay akışı
          <select
            disabled={busy}
            onChange={(event) => selectBlueprint(event.target.value)}
            value={flowId}
          >
            {studioBlueprints.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.label}
              </option>
            ))}
          </select>
          {blueprint ? <small>{blueprint.description}</small> : null}
        </label>
        <label>
          Tema veya varyasyon yönü
          <input
            disabled={busy}
            maxLength={160}
            onChange={(event) => setTheme(event.target.value)}
            placeholder={
              selectedSceneAsset?.semantic?.allowedNarrativeTerms[0]
                ? `Örn. ${selectedSceneAsset.semantic.allowedNarrativeTerms[0]} ile yeni bir olay`
                : "Örn. yağmurlu bir günde yaşanan yeni bir olay"
            }
            required
            value={theme}
          />
        </label>
        <fieldset className="checkbox-group">
          <legend>Hangi yaş aralığına gösterilsin</legend>
          {AGE_BANDS.map((ageBand) => (
            <label className="checkbox-row" key={ageBand}>
              <input
                checked={ageBands.includes(ageBand)}
                disabled={busy}
                onChange={(event) => toggleAgeBand(ageBand, event.target.checked)}
                type="checkbox"
              />
              {ageBand}
            </label>
          ))}
        </fieldset>
        <AdvancedAssetControls
          busy={busy}
          flowAssets={flowAssets}
          onChange={setAssetSelection}
          sceneAssets={sceneAssets}
          selection={assetSelection}
        />
        <button
          className="primary"
          disabled={
            busy ||
            !assetSelection.happyAssetId ||
            !assetSelection.sadAssetId ||
            ageBands.length === 0
          }
          type="submit"
        >
          {busy ? "Üretiliyor ve denetleniyor…" : "Hikâye üret"}
        </button>
      </form>
      {error ? <p className="generation-result alert">{error}</p> : null}
    </section>
  );
}
