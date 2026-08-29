"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { getStoryMediaReadiness } from "../../../lib/media/jobStore";
import type { MediaJob, StoryMediaReadiness } from "../../../lib/media/types";
import { isJobTerminal } from "../pipeline";

const POLL_INTERVAL_MS = 3000;

/** Polls only the graph-scoped read endpoints (Phase 5's "additional
 * decision": GET /api/media/graphs/{graphId}/jobs, plus the Phase 4
 * readiness RPC) -- never the global list_media_jobs() job history, and
 * never a sibling graph's rows. Stops automatically once every tracked job
 * has reached a terminal state (ready/failed). */
export function useMediaJobsPolling(supabase: SupabaseClient, graphId: string | undefined) {
  const [jobs, setJobs] = useState<MediaJob[]>([]);
  const [readiness, setReadiness] = useState<StoryMediaReadiness | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchOnce = useCallback(async () => {
    if (!graphId) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Yönetici oturumu bulunamadı.");
      const response = await fetch(`/api/media/graphs/${graphId}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { jobs?: MediaJob[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşler alınamadı.");
      setJobs(body.jobs ?? []);
      setReadiness(await getStoryMediaReadiness(supabase, graphId));
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "İşler alınamadı.");
    }
  }, [supabase, graphId]);

  useEffect(() => {
    if (!graphId) {
      setJobs([]);
      setReadiness(undefined);
      return;
    }
    setLoading(true);
    void fetchOnce().finally(() => setLoading(false));
    timerRef.current = setInterval(() => void fetchOnce(), POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [graphId, fetchOnce]);

  useEffect(() => {
    if (jobs.length > 0 && jobs.every((job) => isJobTerminal(job.status)) && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, [jobs]);

  return { jobs, readiness, loading, error, refresh: fetchOnce };
}
