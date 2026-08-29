"use client";

import { MediaStatusBadge } from "./MediaStatusBadge";
import type { MediaCardModel } from "./pipeline";

/** One independent card per video clip -- Phase 5's "1 renderable asset = 1
 * card" model. A failed sibling never appears here; this card only ever
 * reflects its own job's status. */
export function VideoClipCard({
  card,
  onPreview,
  onRetry,
  retrying,
}: {
  card: MediaCardModel;
  onPreview: (jobId: string, title: string) => void;
  onRetry: (jobId: string) => void;
  retrying: boolean;
}) {
  const job = card.job;
  const status = job?.status ?? "not_started";
  return (
    <article className="media-asset-card">
      <p className="media-asset-label">{card.label}</p>
      <MediaStatusBadge status={status} />
      {status === "failed" && job?.error ? <p className="media-asset-error">{job.error}</p> : null}
      <div className="media-asset-actions">
        {status === "ready" && job ? (
          <button className="quiet" onClick={() => onPreview(job.id, card.label)} type="button">
            Önizle
          </button>
        ) : null}
        {status === "failed" && job ? (
          <button
            className="quiet"
            disabled={retrying}
            onClick={() => onRetry(job.id)}
            type="button"
          >
            {retrying ? "Tekrar deneniyor…" : "Tekrar Dene"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
