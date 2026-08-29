"use client";

import type { Asset } from "@adaptive/content-schema";
import { useState } from "react";
import { resolveAssetUri } from "../../lib/assetUri";

/** Extracted unchanged from the old asset-first GenerationPanel. Same field,
 * same preview behavior -- only its position in the flow changed (Phase 5:
 * optional/collapsed override, not a required step before generation). */
export function FlowAssetField({
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

export interface AdvancedAssetSelection {
  sceneAssetId: string;
  happyAssetId: string;
  sadAssetId: string;
}

/** Collapsed by default -- the primary Studio flow never requires opening
 * this. Blueprint/template defaults already populate a valid selection;
 * this section exists only for the rare manual override. */
export function AdvancedAssetControls({
  busy,
  sceneAssets,
  flowAssets,
  selection,
  onChange,
}: {
  busy: boolean;
  sceneAssets: Asset[];
  flowAssets: Asset[];
  selection: AdvancedAssetSelection;
  onChange: (next: AdvancedAssetSelection) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedSceneAsset = sceneAssets.find((asset) => asset.id === selection.sceneAssetId);
  const selectedHappyAsset = flowAssets.find((asset) => asset.id === selection.happyAssetId);
  const selectedSadAsset = flowAssets.find((asset) => asset.id === selection.sadAssetId);

  return (
    <div className="advanced-asset-controls">
      <button
        aria-expanded={expanded}
        className="quiet advanced-toggle"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        Gelişmiş / İsteğe bağlı görsel ayarları {expanded ? "−" : "+"}
      </button>
      {expanded ? (
        <div className="advanced-asset-body">
          <p className="generation-help">
            Bu alanlar önceden dolduruldu ve genellikle değiştirilmesi gerekmez. Yalnızca belirli
            bir sahne veya karakter görseli zorunluysa değiştir.
          </p>
          <label>
            Onaylı sahne asset’i
            <select
              disabled={busy}
              onChange={(event) => onChange({ ...selection, sceneAssetId: event.target.value })}
              value={selection.sceneAssetId}
            >
              {sceneAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.id}
                </option>
              ))}
            </select>
            {selectedSceneAsset?.semantic ? (
              <small>
                Bu görsel {selectedSceneAsset.semantic.object} nesnesini gösterir. Uyumlu ifadeler:{" "}
                {selectedSceneAsset.semantic.allowedNarrativeTerms.join(", ")}.
              </small>
            ) : null}
          </label>
          <FlowAssetField
            busy={busy}
            label="Mutlu görsel"
            onChange={(assetId) => onChange({ ...selection, happyAssetId: assetId })}
            options={flowAssets}
            selected={selectedHappyAsset}
            value={selection.happyAssetId}
          />
          <FlowAssetField
            busy={busy}
            label="Üzgün görsel"
            onChange={(assetId) => onChange({ ...selection, sadAssetId: assetId })}
            options={flowAssets}
            selected={selectedSadAsset}
            value={selection.sadAssetId}
          />
        </div>
      ) : null}
    </div>
  );
}
