"use client";

import { MediaStatusBadge } from "./MediaStatusBadge";
import type { MediaCardModel } from "./pipeline";

/** Independent card for one decision question/choice audio asset. The ▶
 * control only ever appears once the asset is actually ready -- it is
 * never replaced by a browser/device TTS fallback. */
export function DecisionAudioCard({
  card,
  onPlay,
  onRetry,
  retrying,
}: {
  card: MediaCardModel;
  onPlay: (jobId: string, title: string) => void;
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
          <button className="quiet" onClick={() => onPlay(job.id, card.label)} type="button">
            ▶ Dinle
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
