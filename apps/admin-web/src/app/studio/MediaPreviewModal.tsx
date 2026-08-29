"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { useSignedPreviewUrl } from "./hooks/useSignedPreviewUrl";

/** Opens fresh every time -- fetches a new signed URL on mount, discards it
 * on close. Native <video>/<audio>, no custom player. Audio preview plays
 * the actual generated M4A asset behind this job's storage_path; there is
 * no TTS fallback anywhere in this component. */
export function MediaPreviewModal({
  supabase,
  jobId,
  kind,
  title,
  onClose,
}: {
  supabase: SupabaseClient;
  jobId: string;
  kind: "video" | "audio";
  title: string;
  onClose: () => void;
}) {
  const { url, loading, error, fetchUrl } = useSignedPreviewUrl(supabase);

  useEffect(() => {
    void fetchUrl(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div className="media-preview-backdrop" onClick={onClose} role="presentation">
      <div className="media-preview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <h3>{title}</h3>
          <button className="quiet" onClick={onClose} type="button">
            Kapat
          </button>
        </div>
        {loading ? <p className="generation-help">Önizleme yükleniyor…</p> : null}
        {error ? <p className="alert">{error}</p> : null}
        {url && kind === "video" ? (
          <video controls autoPlay src={url}>
            <track kind="captions" />
          </video>
        ) : null}
        {url && kind === "audio" ? <audio controls autoPlay src={url} /> : null}
      </div>
    </div>
  );
}
