"use client";

import { contentVersionSchema, storySchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { findAssetById, storyNarratives } from "../lib/storyCopy";
import {
  daysUntilExpiry,
  pendingReviewItems,
  type ReviewItem,
  storyTitle,
} from "../lib/reviewQueue";
import { AiVideoPanel } from "./AiVideoPanel";
import { GamePanel } from "./GamePanel";
import { AssetFrame, StoryCopyList } from "./studio/StoryCopyList";
import { ContentProductionStudio } from "./studio/ContentProductionStudio";

type Screen = "stories" | "games" | "ai-video";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const content = contentVersionSchema.parse(contentJson);

function createBrowserClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

export default function HomePage() {
  const supabase = useMemo(createBrowserClient, []);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("ai-video");

  const loadQueue = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const adminResult = await supabase.rpc("is_content_admin");
    if (adminResult.error || !adminResult.data) {
      setIsAdmin(false);
      setItems([]);
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    const queueResult = await supabase.rpc("list_content_review_queue");
    if (queueResult.error) setMessage(queueResult.error.message);
    else setItems((queueResult.data ?? []) as ReviewItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) void loadQueue();
      else setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadQueue();
      else {
        setIsAdmin(false);
        setItems([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [loadQueue, supabase]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(`Giriş yapılamadı: ${error.code ?? "auth_error"} — ${error.message}`);
      setLoading(false);
    }
  }

  async function decide(decision: "approved" | "rejected") {
    if (!supabase || !selectedId) return;
    const confirmation = window.confirm(
      decision === "approved"
        ? "Bu hikâye yayınlanacak. Devam edilsin mi?"
        : "Hikâye gövdesi kalıcı olarak silinecek. Devam edilsin mi?",
    );
    if (!confirmation) return;
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.rpc("decide_content_review", {
      target_queue_id: selectedId,
      requested_decision: decision,
      decision_reason: decision === "approved" ? "admin_approved" : "admin_rejected",
    });
    if (error) setMessage(error.message);
    else {
      setSelectedId(null);
      setMessage(decision === "approved" ? "Hikâye yayınlandı." : "Hikâye reddedildi ve silindi.");
      await loadQueue();
    }
    setLoading(false);
  }

  if (!supabase)
    return (
      <main className="page-shell">
        <section className="card">
          <h1>Yapılandırma gerekli</h1>
          <p>Admin web ortam değişkenleri eksik.</p>
        </section>
      </main>
    );

  if (!user)
    return (
      <main className="page-shell">
        <form className="card login-card" onSubmit={signIn}>
          <p className="eyebrow">GÜVENLİ YÖNETİM PANELİ</p>
          <h1>İçerik inceleme</h1>
          <p>Bu alan yalnızca izin verilen içerik yöneticilerine açıktır.</p>
          <label>
            E-posta
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Parola
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {message && <p className="alert">{message}</p>}
          <button className="primary" disabled={loading}>
            {loading ? "Kontrol ediliyor…" : "Giriş yap"}
          </button>
        </form>
      </main>
    );

  if (!loading && !isAdmin)
    return (
      <main className="page-shell">
        <section className="card">
          <p className="eyebrow">ERİŞİM REDDEDİLDİ</p>
          <h1>Yönetici izni gerekli</h1>
          <p>Bu hesap içerik yöneticisi listesinde değil.</p>
          <button onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
        </section>
      </main>
    );

  const pending = pendingReviewItems(items);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const parsedSelectedStory = selected?.story ? storySchema.safeParse(selected.story) : null;
  const selectedStory = parsedSelectedStory?.success ? parsedSelectedStory.data : null;
  const storyFlowFrames = selectedStory
    ? selectedStory.flowAssetIds && selectedStory.flowAssetIds.length > 0
      ? selectedStory.flowAssetIds.map((assetId, index) => ({
          key: assetId,
          label: `${index + 1}. içerik`,
          asset: findAssetById(content.assets, assetId),
        }))
      : (() => {
          const introVideoAsset = content.assets.find(
            (asset) => asset.id === selectedStory.introVideoAssetId && asset.type === "video",
          );
          const happyAsset = findAssetById(
            content.assets,
            selectedStory.characterAssets.happyAssetId,
          );
          const sadAsset = findAssetById(content.assets, selectedStory.characterAssets.sadAssetId);
          const angryAsset = findAssetById(
            content.assets,
            selectedStory.characterAssets.angryAssetId,
          );
          return [
            introVideoAsset
              ? { key: "intro", label: "Başlangıç · Video", asset: introVideoAsset }
              : { key: "intro", label: "Başlangıç · Mutlu", asset: happyAsset },
            { key: "sad", label: "Olay sonrası · Üzgün", asset: sadAsset },
            ...(angryAsset ? [{ key: "angry", label: "Kızgın", asset: angryAsset }] : []),
          ];
        })()
    : [];

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ADAPTIVE LEARNING FOR KIDS</p>
          <h1>İçerik İnceleme</h1>
        </div>
        <button className="quiet" onClick={() => supabase.auth.signOut()}>
          Çıkış
        </button>
      </header>
      <nav className="screen-tabs">
        {/* "Hikâye Üretimi" (the pre-AI story review panel) is disabled --
            not deleted -- per request; ContentProductionStudio and its
            review-queue state below are unreachable via the UI but kept
            intact so this can be reversed by restoring the tab button. */}
        <button
          className={screen === "games" ? "selected" : ""}
          onClick={() => setScreen("games")}
          type="button"
        >
          Oyun Üretimi
        </button>
        <button
          className={screen === "ai-video" ? "selected" : ""}
          onClick={() => setScreen("ai-video")}
          type="button"
        >
          AI ile Hikâye Üretimi
        </button>
      </nav>
      {message && <p className="alert global-alert">{message}</p>}
      {screen === "games" ? (
        <GamePanel supabase={supabase} />
      ) : screen === "ai-video" ? (
        <AiVideoPanel supabase={supabase} />
      ) : (
        <>
          <ContentProductionStudio supabase={supabase} />
          <section className="summary-grid">
            <article className="summary-card">
              <strong>{pending.length}</strong>
              <span>Bekleyen kuşkulu içerik</span>
            </article>
            <article className="summary-card">
              <strong>{items.filter((item) => item.status === "approved").length}</strong>
              <span>Onaylanan</span>
            </article>
            <article className="summary-card">
              <strong>
                {
                  items.filter((item) => item.status === "rejected" || item.status === "expired")
                    .length
                }
              </strong>
              <span>Silinen / süresi dolan</span>
            </article>
          </section>
          <section className="workspace">
            <aside className="queue-panel">
              <div className="section-heading">
                <h2>İnceleme kuyruğu</h2>
                <button className="quiet" onClick={loadQueue}>
                  Yenile
                </button>
              </div>
              {loading ? (
                <p>Yükleniyor…</p>
              ) : pending.length === 0 ? (
                <div className="empty">
                  <span>✓</span>
                  <p>Bekleyen kuşkulu içerik yok.</p>
                </div>
              ) : (
                pending.map((item) => (
                  <button
                    key={item.id}
                    className={`queue-item ${selectedId === item.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <strong>{storyTitle(item)}</strong>
                    <span>{item.suspicion_reasons.join(" · ")}</span>
                    <small>{daysUntilExpiry(item.expires_at)} gün kaldı</small>
                  </button>
                ))
              )}
            </aside>
            <article className="preview-panel">
              {!selected ? (
                <div className="empty large">
                  <span>☰</span>
                  <h2>İncelemek için bir hikâye seç</h2>
                  <p>Yalnızca otomatik kontrollerin kuşkulu bulduğu taslaklar burada görünür.</p>
                </div>
              ) : (
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">KUŞKULU TASLAK</p>
                      <h2>{storyTitle(selected)}</h2>
                    </div>
                    <span className="deadline">
                      {daysUntilExpiry(selected.expires_at)} gün kaldı
                    </span>
                  </div>
                  <div className="reason-box">
                    <strong>İnceleme nedenleri</strong>
                    <ul>
                      {selected.suspicion_reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  {selectedStory ? (
                    <div className="story-review-preview">
                      <div className="story-flow-preview" aria-label="Video konsept önizlemesi">
                        {storyFlowFrames.map((frame) => (
                          <AssetFrame asset={frame.asset} key={frame.key} label={frame.label} />
                        ))}
                      </div>
                      <div className="review-story-copy">
                        <p className="review-greeting">{selectedStory.greetingTemplate}</p>
                        <StoryCopyList narratives={storyNarratives(selectedStory)} />
                      </div>
                    </div>
                  ) : null}
                  <details className="technical-story-json">
                    <summary>Teknik JSON’u göster</summary>
                    <pre>{JSON.stringify(selected.story, null, 2)}</pre>
                  </details>
                  <div className="decision-bar">
                    <button
                      className="danger"
                      disabled={loading}
                      onClick={() => decide("rejected")}
                    >
                      Reddet ve sil
                    </button>
                    <button
                      className="primary"
                      disabled={loading}
                      onClick={() => decide("approved")}
                    >
                      Onayla ve yayınla
                    </button>
                  </div>
                </>
              )}
            </article>
          </section>
        </>
      )}
    </main>
  );
}
