"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AiVideoStoryPlan } from "../lib/aiVideoStory";

type AiVideoRequestStatus = "planned" | "jobs_queued" | "rendering" | "ready" | "failed";

interface AiVideoReadiness {
  total_clips: number;
  ready_clips: number;
  failed_clips: number;
  pending_clips: number;
  total_choice_audio: number;
  ready_choice_audio: number;
  failed_choice_audio: number;
  pending_choice_audio: number;
}

interface AiVideoJob {
  id: string;
  scene_id: string | null;
  media_kind: "video" | "audio";
  status: string;
  error: string | null;
}

interface AiVideoGenerationResponse {
  requestId: string;
  storyId: string;
  graphId: string;
  status: AiVideoRequestStatus;
  characterName: string;
  plan: AiVideoStoryPlan;
  readiness?: AiVideoReadiness | null;
  jobs?: AiVideoJob[];
  error?: string | null;
}

interface AiVideoCatalogItem extends AiVideoGenerationResponse {
  graphId: string | null;
  publicationId?: string | null;
  publicationStatus: "draft" | "preparing" | "published" | "failed";
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AiVideoFailure {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
  httpStatus?: number;
  stage?: string;
}

interface AiVideoErrorResponse {
  error?: string;
  details?: string;
  hint?: string;
  code?: string;
  httpStatus?: number;
  stage?: string;
}

interface ProgressItem {
  id: string;
  label: string;
  status: "waiting" | "working" | "ready" | "failed";
  doneCount: number;
  totalCount: number;
}

function aggregateJobStatus(jobs: AiVideoJob[], predicate: (job: AiVideoJob) => boolean) {
  const matching = jobs.filter(predicate);
  if (matching.some((job) => job.status === "failed")) return "failed" as const;
  if (matching.length > 0 && matching.every((job) => job.status === "ready")) {
    return "ready" as const;
  }
  if (matching.some((job) => ["rendering", "uploading"].includes(job.status))) {
    return "working" as const;
  }
  return "waiting" as const;
}

function progressStep(
  id: string,
  label: string,
  jobs: AiVideoJob[],
  predicate: (job: AiVideoJob) => boolean,
): ProgressItem {
  const matching = jobs.filter(predicate);
  return {
    id,
    label,
    status: aggregateJobStatus(jobs, predicate),
    doneCount: matching.filter((job) => job.status === "ready").length,
    totalCount: matching.length,
  };
}

function progressItems(result: AiVideoGenerationResponse): ProgressItem[] {
  const jobs = result.jobs ?? [];
  return [
    {
      id: "character",
      label: `${result.characterName} karakteri ve hikâye planı`,
      status: "ready",
      doneCount: 1,
      totalCount: 1,
    },
    progressStep(
      "intro",
      "Başlangıç ve duygusal olay videosu",
      jobs,
      (job) => job.scene_id === "intro-setup" || job.scene_id === "intro-event",
    ),
    progressStep(
      "emotion",
      "Duygu sorusu ve olumlu dönüt sesleri",
      jobs,
      (job) => job.scene_id === "emotion-question" && job.media_kind === "audio",
    ),
    progressStep(
      "help",
      "Yardım sorusu ve seçim sesleri",
      jobs,
      (job) => job.scene_id === "help-question" && job.media_kind === "audio",
    ),
    progressStep(
      "endings",
      "Seçime bağlı iki sonuç videosu",
      jobs,
      (job) => job.scene_id?.startsWith("ending-") === true && job.media_kind === "video",
    ),
  ];
}

const progressSymbol = { waiting: "○", working: "●", ready: "✓", failed: "!" } as const;

const requestStatusLabels: Record<AiVideoRequestStatus, string> = {
  planned: "Planlandı",
  jobs_queued: "Kuyrukta",
  rendering: "Oluşturuluyor",
  ready: "Medya hazır",
  failed: "Hata",
};

const publicationStatusLabels: Record<AiVideoCatalogItem["publicationStatus"], string> = {
  draft: "Taslak",
  preparing: "Yayına hazırlanıyor",
  published: "Yayında",
  failed: "Yayın hatası",
};

function isReadyToPublish(readiness: AiVideoReadiness | null | undefined): boolean {
  if (!readiness) return false;
  return (
    readiness.total_clips > 0 &&
    readiness.ready_clips === readiness.total_clips &&
    readiness.failed_clips === 0 &&
    readiness.pending_clips === 0 &&
    readiness.total_choice_audio > 0 &&
    readiness.ready_choice_audio === readiness.total_choice_audio &&
    readiness.failed_choice_audio === 0 &&
    readiness.pending_choice_audio === 0
  );
}

const stageLabels: Record<string, string> = {
  server_initialization: "Sunucu ayarları hazırlanırken",
  admin_session: "Yönetici oturumu doğrulanırken",
  input_validation: "Promptlar kontrol edilirken",
  name_inventory: "Kullanılmış karakter adları alınırken",
  story_planning: "AI hikâye planını oluştururken",
  plan_validation: "AI hikâye planı kontrol edilirken",
  name_reservation: "Yeni karakter adı ayrılırken",
  playback_graph: "Etkileşimli hikâye akışı oluşturulurken",
  media_queue: "Video ve ses işleri kuyruğa eklenirken",
  graph_attachment: "Medya işleri hikâyeye bağlanırken",
  status_session: "Durum sorgusu için oturum doğrulanırken",
  request_status: "Hikâye üretim kaydı alınırken",
  media_status: "Video ve ses üretim durumları alınırken",
  status_update: "Hikâye üretim durumu güncellenirken",
  catalog_session: "Hikâye kataloğu için oturum doğrulanırken",
  catalog_load: "Kayıtlı hikâyeler Supabase’ten alınırken",
  publication_session: "Paylaşım yetkisi doğrulanırken",
  publication_prepare: "Hikâye yayına hazırlanırken",
  publication_copy: "Video ve sesler yayın alanına kopyalanırken",
  publication_finalize: "Hikâye tüm kullanıcılarla paylaşılırken",
  delete_session: "Silme yetkisi doğrulanırken",
  delete_database: "Hikâye Supabase’ten silinirken",
  delete_storage: "Hikâyenin video ve ses dosyaları silinirken",
};

function failureFromResponse(body: AiVideoErrorResponse, fallback: string): AiVideoFailure {
  return {
    message: body.error?.trim() || fallback,
    ...(body.details ? { details: body.details } : {}),
    ...(body.hint ? { hint: body.hint } : {}),
    ...(body.code ? { code: body.code } : {}),
    ...(body.httpStatus ? { httpStatus: body.httpStatus } : {}),
    ...(body.stage ? { stage: body.stage } : {}),
  };
}

function failureFromThrown(error: unknown, fallback: string): AiVideoFailure {
  return { message: error instanceof Error ? error.message : fallback };
}

function FailureDetails({ failure }: { failure: AiVideoFailure }) {
  const hasTechnicalDetails = Boolean(
    failure.stage || failure.code || failure.httpStatus || failure.details || failure.hint,
  );
  return (
    <div className="ai-video-failure" role="alert">
      <strong>{failure.message}</strong>
      {hasTechnicalDetails ? (
        <details open>
          <summary>Hata ayrıntıları</summary>
          <dl>
            {failure.stage ? (
              <>
                <dt>Aşama</dt>
                <dd>{stageLabels[failure.stage] ?? failure.stage}</dd>
              </>
            ) : null}
            {failure.code ? (
              <>
                <dt>Hata kodu</dt>
                <dd>{failure.code}</dd>
              </>
            ) : null}
            {failure.httpStatus ? (
              <>
                <dt>HTTP durumu</dt>
                <dd>{failure.httpStatus}</dd>
              </>
            ) : null}
            {failure.details ? (
              <>
                <dt>Teknik ayrıntı</dt>
                <dd>{failure.details}</dd>
              </>
            ) : null}
            {failure.hint ? (
              <>
                <dt>İpucu</dt>
                <dd>{failure.hint}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

export function AiVideoPanel({ supabase }: { supabase: SupabaseClient }) {
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [storyPrompt, setStoryPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiVideoGenerationResponse | null>(null);
  const [failure, setFailure] = useState<AiVideoFailure | null>(null);
  const [stories, setStories] = useState<AiVideoCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<"delete" | "publish" | "edit" | null>(null);
  const [queueFilter, setQueueFilter] = useState<"all" | "published" | "in_progress">(
    "in_progress",
  );
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [progressCollapsed, setProgressCollapsed] = useState(false);
  const selected = stories.find((story) => story.requestId === selectedId) ?? null;
  const progress = useMemo(() => (selected ? progressItems(selected) : []), [selected]);
  const visibleStories = stories.filter((story) => {
    if (queueFilter === "published") return story.publicationStatus === "published";
    if (queueFilter === "in_progress") return story.publicationStatus !== "published";
    return true;
  });

  const accessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Yönetici oturumu bulunamadı.");
    return token;
  }, [supabase]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const token = await accessToken();
      const response = await fetch("/api/ai-video/stories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { stories?: AiVideoCatalogItem[] } & AiVideoErrorResponse;
      if (!response.ok) {
        setFailure(failureFromResponse(body, "Kayıtlı hikâyeler alınamadı."));
        return;
      }
      const nextStories = body.stories ?? [];
      setStories(nextStories);
      setSelectedId((current) =>
        current && nextStories.some((story) => story.requestId === current)
          ? current
          : (nextStories[0]?.requestId ?? null),
      );
    } catch (error) {
      setFailure(failureFromThrown(error, "Kayıtlı hikâyeler alınamadı."));
    } finally {
      setCatalogLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    setEditingTitle(null);
    setProgressCollapsed(false);
  }, [selectedId]);

  useEffect(() => {
    if (!result || result.status === "ready" || result.status === "failed") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const token = await accessToken();
        const response = await fetch(`/api/ai-video/stories/${result.requestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json()) as AiVideoGenerationResponse & AiVideoErrorResponse;
        if (!response.ok) {
          if (!cancelled) setFailure(failureFromResponse(body, "Üretim durumu alınamadı."));
          return;
        }
        if (!cancelled) {
          setResult((current) => (current ? { ...current, ...body } : body));
          setStories((current) =>
            current.map((story) =>
              story.requestId === body.requestId ? { ...story, ...body } : story,
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setFailure(failureFromThrown(error, "Üretim durumu alınamadı."));
        }
      }
    };
    const timer = window.setInterval(() => void poll(), 3_000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken, result?.requestId, result?.status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    setResult(null);
    try {
      const token = await accessToken();
      const response = await fetch("/api/ai-video/stories", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ characterPrompt, storyPrompt }),
      });
      const body = (await response.json()) as AiVideoGenerationResponse & AiVideoErrorResponse;
      if (!response.ok) {
        setFailure(failureFromResponse(body, "AI video hikâyesi oluşturulamadı."));
        return;
      }
      setResult(body);
      setSelectedId(body.requestId);
      await loadCatalog();
      setCharacterPrompt("");
      setStoryPrompt("");
    } catch (error) {
      setFailure(failureFromThrown(error, "AI video hikâyesi oluşturulamadı."));
    } finally {
      setBusy(false);
    }
  }

  async function publishSelected() {
    if (!selected || actionBusy) return;
    setActionBusy("publish");
    setFailure(null);
    try {
      const token = await accessToken();
      const response = await fetch(`/api/ai-video/stories/${selected.requestId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as AiVideoErrorResponse;
      if (!response.ok) {
        setFailure(failureFromResponse(body, "Hikâye uygulamada paylaşılamadı."));
        return;
      }
      await loadCatalog();
    } catch (error) {
      setFailure(failureFromThrown(error, "Hikâye uygulamada paylaşılamadı."));
    } finally {
      setActionBusy(null);
    }
  }

  async function deleteSelected(force = false) {
    if (!selected || actionBusy) return;
    const confirmed = window.confirm(
      force
        ? `Worker durmuş olsa bile "${selected.plan.title}" hikâyesi zorla silinsin mi? Bu, gerçekten hâlâ render ediliyorsa yarım kalmış dosyalara yol açabilir.`
        : `“${selected.plan.title}” hikâyesi, video ve ses dosyalarıyla birlikte silinsin mi?`,
    );
    if (!confirmed) return;

    setActionBusy("delete");
    setFailure(null);
    try {
      const token = await accessToken();
      const response = await fetch(
        `/api/ai-video/stories/${selected.requestId}${force ? "?force=true" : ""}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const body = (await response.json()) as AiVideoErrorResponse;
      if (!response.ok) {
        const stillRendering = body.error?.includes("cannot be deleted while media is rendering");
        setFailure(
          failureFromResponse(
            body,
            stillRendering && !force
              ? "Hikâye render ediliyor. Worker'ı durdurduysanız ve hâlâ silemiyorsanız, zorla silmeyi deneyebilirsiniz."
              : "Hikâye silinemedi.",
          ),
        );
        return;
      }
      setResult((current) => (current?.requestId === selected.requestId ? null : current));
      await loadCatalog();
    } catch (error) {
      setFailure(failureFromThrown(error, "Hikâye silinemedi."));
    } finally {
      setActionBusy(null);
    }
  }

  async function saveTitle() {
    if (!selected || actionBusy || editingTitle === null) return;
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;
    setActionBusy("edit");
    setFailure(null);
    try {
      const token = await accessToken();
      const response = await fetch(`/api/ai-video/stories/${selected.requestId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      const body = (await response.json()) as AiVideoErrorResponse;
      if (!response.ok) {
        setFailure(failureFromResponse(body, "Hikâye başlığı güncellenemedi."));
        return;
      }
      setEditingTitle(null);
      await loadCatalog();
    } catch (error) {
      setFailure(failureFromThrown(error, "Hikâye başlığı güncellenemedi."));
    } finally {
      setActionBusy(null);
    }
  }

  const publishedCount = stories.filter((story) => story.publicationStatus === "published").length;
  const inProgressCount = stories.length - publishedCount;

  return (
    <section className="generation-card ai-video-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ETKİLEŞİMLİ AI VİDEO</p>
          <h2>Yeni hikâye oluştur</h2>
        </div>
        <span className="server-only-badge">İsimler tekrar kullanılmaz</span>
      </div>

      <form className="ai-video-form" onSubmit={submit}>
        <label>
          1. Karakter
          <textarea
            disabled={busy}
            maxLength={600}
            minLength={20}
            onChange={(event) => setCharacterPrompt(event.target.value)}
            placeholder="Örn. Büyük yeşil gözlü, mor tasmalı, turuncu ve neşeli bir yavru kedi oluştur."
            required
            rows={5}
            value={characterPrompt}
          />
          <small>Karakterin görünüşünü tarif et. Kullanılmamış ismi sistem otomatik verir.</small>
        </label>

        <label>
          2. Hikâye fikri
          <textarea
            disabled={busy}
            maxLength={600}
            minLength={20}
            onChange={(event) => setStoryPrompt(event.target.value)}
            placeholder="Örn. Parkta kırmızı balonuyla oynarken balonu patlasın ve üzgün kalsın."
            required
            rows={5}
            value={storyPrompt}
          />
          <small>Mutlu başlangıcı ve duygusal dönüt alınacak olayı tarif et.</small>
        </label>

        <button className="primary ai-video-submit" disabled={busy} type="submit">
          {busy ? "Hikâye planlanıyor…" : "3. Hikâyeyi oluştur"}
        </button>
      </form>

      {failure ? <FailureDetails failure={failure} /> : null}

      <section className="summary-grid">
        <button
          className={`summary-card ${queueFilter === "all" ? "active" : ""}`}
          onClick={() => setQueueFilter("all")}
          type="button"
        >
          <strong>{stories.length}</strong>
          <span>Toplam AI hikâyesi</span>
        </button>
        <button
          className={`summary-card ${queueFilter === "published" ? "active" : ""}`}
          onClick={() => setQueueFilter("published")}
          type="button"
        >
          <strong>{publishedCount}</strong>
          <span>Yayında</span>
        </button>
        <button
          className={`summary-card ${queueFilter === "in_progress" ? "active" : ""}`}
          onClick={() => setQueueFilter("in_progress")}
          type="button"
        >
          <strong>{inProgressCount}</strong>
          <span>Hazırlanıyor / hata</span>
        </button>
      </section>

      <section className="workspace">
        <aside className="queue-panel">
          <div className="section-heading">
            <h2>AI hikâye kuyruğu</h2>
            <button className="quiet" disabled={catalogLoading} onClick={() => void loadCatalog()}>
              Yenile
            </button>
          </div>
          {catalogLoading ? (
            <p>Yükleniyor…</p>
          ) : visibleStories.length === 0 ? (
            <div className="empty">
              <span>○</span>
              <p>
                {stories.length === 0
                  ? "Henüz AI ile üretilmiş bir hikâye yok."
                  : "Bu filtreye uyan hikâye yok."}
              </p>
            </div>
          ) : (
            visibleStories.map((story) => {
              const itemProgress = progressItems(story);
              const doneCount = itemProgress.filter((item) => item.status === "ready").length;
              return (
                <button
                  key={story.requestId}
                  className={`queue-item ${selectedId === story.requestId ? "selected" : ""}`}
                  onClick={() => setSelectedId(story.requestId)}
                >
                  <strong>{story.plan.title}</strong>
                  <span>
                    {story.characterName} · {requestStatusLabels[story.status]} ·{" "}
                    {doneCount}/{itemProgress.length} tamamlandı
                  </span>
                  <small>{publicationStatusLabels[story.publicationStatus]}</small>
                </button>
              );
            })
          )}
        </aside>
        <article className="preview-panel">
          {!selected ? (
            <div className="empty large">
              <span>☰</span>
              <h2>İncelemek için bir hikâye seç</h2>
              <p>AI ile üretilen hikâyeler burada listelenir; birini seçince ilerlemesini görebilirsin.</p>
            </div>
          ) : (
            <div className="ai-video-result">
              <div className="ai-video-result-heading">
                <div>
                  <p className="eyebrow">{publicationStatusLabels[selected.publicationStatus]}</p>
                  {editingTitle !== null ? (
                    <div className="ai-video-title-edit">
                      <input
                        disabled={actionBusy !== null}
                        maxLength={120}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        value={editingTitle}
                      />
                      <button
                        className="quiet"
                        disabled={actionBusy !== null || !editingTitle.trim()}
                        onClick={() => void saveTitle()}
                        type="button"
                      >
                        {actionBusy === "edit" ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                      <button
                        className="quiet"
                        disabled={actionBusy !== null}
                        onClick={() => setEditingTitle(null)}
                        type="button"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <div className="ai-video-title-edit">
                      <h3>{selected.plan.title}</h3>
                      <button
                        className="quiet"
                        disabled={actionBusy !== null}
                        onClick={() => setEditingTitle(selected.plan.title)}
                        type="button"
                      >
                        Düzenle
                      </button>
                    </div>
                  )}
                  <p>
                    Karakter: <strong>{selected.characterName}</strong>
                  </p>
                </div>
                <span className={`ai-video-status ${selected.status}`}>
                  {requestStatusLabels[selected.status]}
                </span>
              </div>

              <div className="section-heading">
                <h4>İlerleme</h4>
                <button
                  className="quiet"
                  onClick={() => setProgressCollapsed((current) => !current)}
                  type="button"
                >
                  {progressCollapsed ? "Genişlet" : "Küçült"}
                </button>
              </div>
              {progressCollapsed ? (
                <p className="ai-video-progress-summary">
                  {progress.filter((item) => item.status === "ready").length}/{progress.length}{" "}
                  adım tamamlandı
                </p>
              ) : (
                <ol className="ai-video-progress">
                  {progress.map((item) => (
                    <li className={item.status} key={item.id}>
                      <span aria-hidden="true">{progressSymbol[item.status]}</span>
                      <p>
                        {item.label}
                        {item.totalCount > 1 ? (
                          <span className="ai-video-progress-count">
                            {" "}
                            ({item.doneCount}/{item.totalCount})
                          </span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              <div className="ai-video-plan-summary">
                <article>
                  <small>Duygu seçenekleri</small>
                  <strong>
                    {selected.plan.emotionQuestion.options.map((option) => option.label).join(" · ")}
                  </strong>
                </article>
                <article>
                  <small>Yardım seçenekleri</small>
                  <strong>
                    {selected.plan.helpQuestion.options.map((option) => option.label).join(" · ")}
                  </strong>
                </article>
              </div>

              {selected.error ? (
                <FailureDetails
                  failure={{
                    message: selected.error,
                    stage: "media_status",
                    details:
                      selected.jobs
                        ?.filter((job) => job.status === "failed" && job.error)
                        .map((job) => `${job.scene_id ?? job.id}: ${job.error}`)
                        .join("\n") || undefined,
                  }}
                />
              ) : null}

              <div className="decision-bar">
                <button
                  className="danger"
                  disabled={actionBusy !== null}
                  onClick={() => void deleteSelected()}
                >
                  {actionBusy === "delete" ? "Siliniyor…" : "Sil"}
                </button>
                <button
                  className="quiet"
                  disabled={actionBusy !== null}
                  onClick={() => void deleteSelected(true)}
                  title="Worker durdurulduğu için normal silme çalışmıyorsa kullanın"
                  type="button"
                >
                  Zorla sil
                </button>
                <button
                  className="primary"
                  disabled={
                    actionBusy !== null ||
                    selected.publicationStatus === "published" ||
                    !isReadyToPublish(selected.readiness)
                  }
                  onClick={() => void publishSelected()}
                >
                  {actionBusy === "publish"
                    ? "Paylaşılıyor…"
                    : selected.publicationStatus === "published"
                      ? "Uygulamada yayında"
                      : "Uygulamada paylaş"}
                </button>
              </div>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
