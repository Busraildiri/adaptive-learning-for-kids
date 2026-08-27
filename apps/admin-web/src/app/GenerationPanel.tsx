"use client";

import { type AgeBand, type Asset, contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useMemo, useState } from "react";
import { resolveAssetUri } from "../lib/assetUri";
import {
  AGE_BANDS,
  isAllowedSceneAsset,
  isUsableFlowAsset,
  themeConflictsWithAsset,
} from "../lib/generation";
import { storyBlueprints } from "../lib/storyBlueprints";

const content = contentVersionSchema.parse(contentJson);
interface GenerationResponse {
  requestId?: string;
  storyId?: string;
  status?: "published" | "queued_for_review" | "not_publishable";
  rejectionReasons?: string[];
  technicalError?: string;
  error?: string;
}

function FlowAssetField({
  label,
  busy,
  value,
  onChange,
  options,
  selected,
  allowEmpty,
}: {
  label: string;
  busy: boolean;
  value: string;
  onChange: (assetId: string) => void;
  options: Asset[];
  selected: Asset | undefined;
  allowEmpty?: boolean;
}) {
  return (
    <label>
      {label}
      <select disabled={busy} onChange={(event) => onChange(event.target.value)} value={value}>
        {allowEmpty ? <option value="">Seçilmedi</option> : null}
        {options.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.id}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="asset-preview" aria-label={`Seçilen ${label.toLocaleLowerCase("tr-TR")}`}>
          {selected.uri.startsWith("emoji:") ? (
            <span aria-hidden="true" className="asset-preview-symbol">
              {selected.uri.slice("emoji:".length)}
            </span>
          ) : selected.type === "video" ? (
            <video
              className="asset-preview-image"
              controls
              muted
              src={resolveAssetUri(selected.uri)}
            >
              <track kind="captions" />
            </video>
          ) : selected.type === "image" ? (
            <img
              alt={selected.accessibilityLabel}
              className="asset-preview-image"
              src={resolveAssetUri(selected.uri)}
            />
          ) : (
            <span className="asset-preview-unavailable">Bu asset için önizleme yok.</span>
          )}
          <span>
            <strong>{selected.accessibilityLabel}</strong>
            <small>{selected.id}</small>
          </span>
        </div>
      ) : null}
    </label>
  );
}

export function GenerationPanel({
  supabase,
  onGenerated,
}: {
  supabase: SupabaseClient;
  onGenerated: () => Promise<void>;
}) {
  const [flowId, setFlowId] = useState(storyBlueprints[0]?.id ?? "");
  const blueprint = storyBlueprints.find((candidate) => candidate.id === flowId);
  const template = content.stories.find((story) => story.id === blueprint?.mechanicsSourceStoryId);
  const sceneAssets = useMemo(
    () => content.assets.filter((asset) => template && isAllowedSceneAsset(asset, template)),
    [template],
  );
  const flowAssets = useMemo(() => content.assets.filter(isUsableFlowAsset), []);
  const emotions = useMemo(
    () => [
      ...new Set(
        template?.steps
          .filter((step) => step.type === "emotion_choice")
          .flatMap((step) => step.choices.map((choice) => choice.emotion)) ?? [],
      ),
    ],
    [template],
  );
  const [theme, setTheme] = useState("");
  const [targetEmotion, setTargetEmotion] = useState("");
  const [sceneAssetId, setSceneAssetId] = useState(
    sceneAssets.find((asset) => asset.id === blueprint?.defaultSceneAssetId)?.id ??
      sceneAssets[0]?.id ??
      "",
  );
  const selectedSceneAsset = sceneAssets.find((asset) => asset.id === sceneAssetId);
  const [happyAssetId, setHappyAssetId] = useState(template?.characterAssets.happyAssetId ?? "");
  const [sadAssetId, setSadAssetId] = useState(template?.characterAssets.sadAssetId ?? "");
  const selectedHappyAsset = flowAssets.find((asset) => asset.id === happyAssetId);
  const selectedSadAsset = flowAssets.find((asset) => asset.id === sadAssetId);
  const [ageBands, setAgeBands] = useState<AgeBand[]>(template?.ageBands ?? ["2-4"]);
  const toggleAgeBand = (ageBand: AgeBand, checked: boolean) => {
    setAgeBands((current) =>
      checked ? [...current, ageBand] : current.filter((value) => value !== ageBand),
    );
  };
  const [sendToReview, setSendToReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedSceneAsset && themeConflictsWithAsset(theme, selectedSceneAsset)) {
      setResult(
        `Tema bu görselle çelişiyor. Bu sahne için şu ifadelerden birini kullan: ${selectedSceneAsset.semantic?.allowedNarrativeTerms.join(", ")}.`,
      );
      return;
    }
    setBusy(true);
    setResult(null);
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
          targetEmotion: targetEmotion || emotions[0],
          sceneAssetId,
          flowAssetIds: [happyAssetId, sadAssetId],
          ageBands,
          sendToReview,
        }),
      });
      const body = (await response.json()) as GenerationResponse;
      if (!response.ok) throw new Error(body.error ?? "Hikâye üretilemedi.");
      if (body.status === "published")
        setResult("Hikâye kontrolleri geçti ve yayın havuzuna alındı.");
      else if (body.status === "queued_for_review") {
        setResult("Hikâye inceleme kuyruğuna gönderildi.");
      } else {
        const reasons = (body.rejectionReasons ?? []).join(", ");
        setResult(
          `Taslak yayınlanmadı: ${reasons}${body.technicalError ? ` — ${body.technicalError}` : ""}`,
        );
      }
      setTheme("");
      await onGenerated();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Hikâye üretilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="generation-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">OPENAI İÇERİK ÜRETİMİ</p>
          <h2>Yeni hikâye üret</h2>
        </div>
        <span className="server-only-badge">Anahtar yalnızca sunucuda</span>
      </div>
      <p className="generation-help">
        Model oyun mekaniğini değiştiremez. Yalnızca seçilen şablonun kısa Türkçe anlatım varyantını
        üretir; şema ve güvenlik kontrolleri geçmeden yayınlanmaz.
      </p>
      <form className="generation-form" onSubmit={submit}>
        <label>
          Olay akışı
          <select
            disabled={busy}
            onChange={(event) => {
              const nextFlowId = event.target.value;
              const nextBlueprint = storyBlueprints.find(
                (candidate) => candidate.id === nextFlowId,
              );
              const nextTemplate = content.stories.find(
                (story) => story.id === nextBlueprint?.mechanicsSourceStoryId,
              );
              const nextAssets = content.assets.filter(
                (asset) => nextTemplate && isAllowedSceneAsset(asset, nextTemplate),
              );
              setFlowId(nextFlowId);
              setTargetEmotion("");
              setSceneAssetId(
                nextAssets.find((asset) => asset.id === nextBlueprint?.defaultSceneAssetId)?.id ??
                  nextAssets[0]?.id ??
                  "",
              );
              setHappyAssetId(nextTemplate?.characterAssets.happyAssetId ?? "");
              setSadAssetId(nextTemplate?.characterAssets.sadAssetId ?? "");
              setAgeBands(nextTemplate?.ageBands ?? ["2-4"]);
            }}
            value={flowId}
          >
            {storyBlueprints.map((flow) => (
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
        <label>
          Hedef duygu
          <select
            disabled={busy}
            onChange={(event) => setTargetEmotion(event.target.value)}
            value={targetEmotion || emotions[0] || ""}
          >
            {emotions.map((emotion) => (
              <option key={emotion} value={emotion}>
                {emotion}
              </option>
            ))}
          </select>
        </label>
        <label>
          Onaylı sahne asset’i
          <select
            disabled={busy}
            onChange={(event) => setSceneAssetId(event.target.value)}
            value={sceneAssetId}
          >
            {sceneAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.id}
              </option>
            ))}
          </select>
          {selectedSceneAsset ? (
            <div className="asset-preview" aria-label="Seçilen sahne görseli">
              {selectedSceneAsset.uri.startsWith("emoji:") ? (
                <span aria-hidden="true" className="asset-preview-symbol">
                  {selectedSceneAsset.uri.slice("emoji:".length)}
                </span>
              ) : selectedSceneAsset.type === "image" ? (
                <img
                  alt={selectedSceneAsset.accessibilityLabel}
                  className="asset-preview-image"
                  src={resolveAssetUri(selectedSceneAsset.uri)}
                />
              ) : (
                <span className="asset-preview-unavailable">
                  Bu asset için görsel önizleme yok.
                </span>
              )}
              <span>
                <strong>{selectedSceneAsset.accessibilityLabel}</strong>
                <small>{selectedSceneAsset.id}</small>
              </span>
            </div>
          ) : null}
          {selectedSceneAsset?.semantic ? (
            <small>
              Bu görsel {selectedSceneAsset.semantic.object} nesnesini gösterir. Uyumlu ifadeler:{" "}
              {selectedSceneAsset.semantic.allowedNarrativeTerms.join(", ")}.
            </small>
          ) : null}
        </label>
        <p className="generation-help">
          Bu iki görsel, çocuğun gerçekte göreceği tek şey: hikâye başlarken ve yardım seçilene
          kadar "mutlu" görsel, kötü olaydan sonra "üzgün" görsel gösterilir — sonra otomatik olarak
          tekrar mutlu'ya döner. Ara adımlar arasında farklı görsel geçişi şu an desteklenmiyor.
        </p>
        <FlowAssetField
          busy={busy}
          label="Mutlu görsel"
          onChange={setHappyAssetId}
          options={flowAssets}
          selected={selectedHappyAsset}
          value={happyAssetId}
        />
        <FlowAssetField
          busy={busy}
          label="Üzgün görsel"
          onChange={setSadAssetId}
          options={flowAssets}
          selected={selectedSadAsset}
          value={sadAssetId}
        />
        <label className="checkbox-row">
          <input
            checked={sendToReview}
            disabled={busy}
            onChange={(event) => setSendToReview(event.target.checked)}
            type="checkbox"
          />
          Bu test üretimini doğrudan inceleme kuyruğuna gönder
        </label>
        <button
          className="primary"
          disabled={
            busy || emotions.length === 0 || !happyAssetId || !sadAssetId || ageBands.length === 0
          }
          type="submit"
        >
          {busy ? "Üretiliyor ve denetleniyor…" : "Hikâye üret"}
        </button>
      </form>
      {result ? <p className="generation-result">{result}</p> : null}
    </section>
  );
}
