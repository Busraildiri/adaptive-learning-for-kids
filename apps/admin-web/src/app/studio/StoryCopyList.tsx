"use client";

import type { Asset } from "@adaptive/content-schema";
import { resolveAssetUri } from "../../lib/assetUri";

export function AssetFrame({ label, asset }: { label: string; asset: Asset | undefined }) {
  return (
    <div className="story-flow-frame">
      {!asset ? (
        <p>Bu kare için asset bulunamadı.</p>
      ) : asset.type === "video" ? (
        <video controls preload="metadata" src={resolveAssetUri(asset.uri)}>
          <track kind="captions" />
        </video>
      ) : asset.uri.startsWith("emoji:") ? (
        <span aria-hidden="true" className="review-media-symbol">
          {asset.uri.slice("emoji:".length)}
        </span>
      ) : asset.type === "image" ? (
        <img alt={asset.accessibilityLabel} src={resolveAssetUri(asset.uri)} />
      ) : (
        <p>Bu taslak için görüntülenebilir bir medya asset’i yok.</p>
      )}
      <small>
        {label}
        {asset?.accessibilityLabel ? ` · ${asset.accessibilityLabel}` : ""}
      </small>
    </div>
  );
}

/** Ordered, human-readable narration list -- shared by the legacy review
 * workspace and the Content Production Studio so a Story renders identically
 * in both places instead of two independently-maintained flatteners. */
export function StoryCopyList({ narratives }: { narratives: string[] }) {
  return (
    <ol className="story-copy-list">
      {narratives.map((narrative, index) => (
        <li key={`${index}-${narrative}`}>{narrative}</li>
      ))}
    </ol>
  );
}
