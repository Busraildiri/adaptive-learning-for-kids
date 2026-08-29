"use client";

import type { PlaybackClip } from "@adaptive/media-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";
import { retryMediaJob } from "../../lib/media/jobStore";
import type { MediaJob } from "../../lib/media/types";
import { DecisionAudioCard } from "./DecisionAudioCard";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { groupJobsByRole } from "./pipeline";
import { VideoClipCard } from "./VideoClipCard";

interface PreviewTarget {
  jobId: string;
  title: string;
  kind: "video" | "audio";
}

/** One independent card per renderable asset (video clips + decision
 * question/choice audio), never a single aggregate percentage. Partial
 * success is the natural default: each card only ever reflects its own
 * job's row. */
export function MediaProductionPanel({
  supabase,
  clips,
  jobs,
  narrationByClipId,
  onJobsChanged,
}: {
  supabase: SupabaseClient;
  clips: PlaybackClip[];
  jobs: MediaJob[];
  narrationByClipId: Record<string, string>;
  onJobsChanged: () => void;
}) {
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const { videoCards, audioCards } = groupJobsByRole(clips, jobs, narrationByClipId);

  async function retry(jobId: string) {
    setRetryingJobId(jobId);
    try {
      await retryMediaJob(supabase, jobId);
      onJobsChanged();
    } finally {
      setRetryingJobId(null);
    }
  }

  return (
    <section className="media-production-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MEDYA ÜRETİMİ</p>
          <h2>Her varlığın kendi durumu</h2>
        </div>
      </div>
      <div className="media-card-grid">
        {videoCards.map((card) => (
          <VideoClipCard
            card={card}
            key={card.key}
            onPreview={(jobId, title) => setPreview({ jobId, title, kind: "video" })}
            onRetry={(jobId) => void retry(jobId)}
            retrying={retryingJobId === card.job?.id}
          />
        ))}
        {audioCards.map((card) => (
          <DecisionAudioCard
            card={card}
            key={card.key}
            onPlay={(jobId, title) => setPreview({ jobId, title, kind: "audio" })}
            onRetry={(jobId) => void retry(jobId)}
            retrying={retryingJobId === card.job?.id}
          />
        ))}
      </div>
      {preview ? (
        <MediaPreviewModal
          jobId={preview.jobId}
          kind={preview.kind}
          onClose={() => setPreview(null)}
          supabase={supabase}
          title={preview.title}
        />
      ) : null}
    </section>
  );
}
