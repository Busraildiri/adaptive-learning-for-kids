"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useState } from "react";

/** Fetches a fresh signed URL on demand from the existing Phase 4 route
 * (GET /api/media/jobs/[jobId]/signed-url). Never caches the URL beyond
 * this hook's own state -- the durable identity stays storage_path,
 * server-side; a re-open (or an expired URL) simply requests a new one. */
export function useSignedPreviewUrl(supabase: SupabaseClient) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUrl = useCallback(
    async (jobId: string) => {
      setLoading(true);
      setError(null);
      setUrl(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Yönetici oturumu bulunamadı.");
        const response = await fetch(`/api/media/jobs/${jobId}/signed-url`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json()) as { signedUrl?: string; error?: string };
        if (!response.ok || !body.signedUrl) {
          throw new Error(body.error ?? "Önizleme bağlantısı alınamadı.");
        }
        setUrl(body.signedUrl);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Önizleme bağlantısı alınamadı.");
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  const reset = useCallback(() => {
    setUrl(null);
    setError(null);
  }, []);

  return { url, loading, error, fetchUrl, reset };
}
