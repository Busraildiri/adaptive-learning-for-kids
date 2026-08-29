"use client";

import type { StoryMediaReadiness } from "../../lib/media/types";
import { deriveReadinessBanner } from "./pipeline";

export type PublicationStatus = "idle" | "publishing" | "published" | "failed";

export interface PublicationState {
  status: PublicationStatus;
  publishedVersion?: number;
  publishedAt?: string;
  error?: string;
}

/** Renders Phase 4's get_story_media_readiness result as one banner --
 * gating is entirely backend-derived (story approval + readiness counts),
 * never a separately-maintained frontend calculation. The Publish action
 * only ever appears once that backend-derived banner says
 * "ready_for_publish" -- it is never a frontend-only state: every click
 * goes through the PREPARE/COPY/FINALIZE protocol server-side. */
export function ProductionReadiness({
  readiness,
  storyApproved,
  publication,
  onPublish,
}: {
  readiness: StoryMediaReadiness | undefined;
  storyApproved: boolean;
  publication: PublicationState;
  onPublish: () => void;
}) {
  const banner = deriveReadinessBanner(readiness, storyApproved);
  const canOfferPublish = banner.kind === "ready_for_publish" || publication.status !== "idle";

  return (
    <section className={`production-readiness production-readiness-${banner.kind}`}>
      <p>{banner.label}</p>
      {canOfferPublish ? (
        <div className="publish-action">
          {publication.status === "published" ? (
            <p className="publish-status publish-status-published">
              Yayınlandı{publication.publishedVersion ? ` v${publication.publishedVersion}` : ""}
              {publication.publishedAt
                ? ` · ${new Date(publication.publishedAt).toLocaleString("tr-TR")}`
                : ""}
            </p>
          ) : (
            <>
              {publication.status === "failed" ? (
                <p className="publish-status publish-status-failed">
                  Yayın başarısız{publication.error ? `: ${publication.error}` : ""}
                </p>
              ) : null}
              {banner.kind === "ready_for_publish" || publication.status === "failed" ? (
                <button
                  className="primary"
                  disabled={publication.status === "publishing"}
                  onClick={onPublish}
                  type="button"
                >
                  {publication.status === "publishing"
                    ? "Yayın hazırlanıyor…"
                    : publication.status === "failed"
                      ? "Yayınlamayı Tekrar Dene"
                      : "Yayınla"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
