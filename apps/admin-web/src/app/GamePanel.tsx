"use client";

import {
  type BalloonCountingGame,
  type ClassifyAndSortGame,
  contentVersionSchema,
  type EmotionCluesGame,
  type FishPatternsGame,
  type Game,
  type GameRule,
  gameSchema,
  type MiniChallengeGame,
  type SequenceAndPlaceGame,
  type TapOrWaitGame,
} from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const content = contentVersionSchema.parse(contentJson);

function getInitialGame(): Game {
  const game = content.games?.[0];
  if (!game) throw new Error("Başlangıç oyunu bulunamadı.");
  return game;
}

const initialGame = getInitialGame();

function getInitialSortGame(): ClassifyAndSortGame {
  const game = content.games?.find(
    (candidate): candidate is ClassifyAndSortGame => candidate.mechanic === "classify_and_sort",
  );
  if (!game) throw new Error("Başlangıç sınıflandırma oyunu bulunamadı.");
  return game;
}

const initialSortGame = getInitialSortGame();

function getInitialRoutineGame(): SequenceAndPlaceGame {
  const game = content.games?.find(
    (candidate): candidate is SequenceAndPlaceGame => candidate.mechanic === "sequence_and_place",
  );
  if (!game) throw new Error("Başlangıç rutin oyunu bulunamadı.");
  return game;
}

const initialRoutineGame = getInitialRoutineGame();

function getInitialEmotionGame(): EmotionCluesGame {
  const game = content.games?.find(
    (candidate): candidate is EmotionCluesGame => candidate.mechanic === "emotion_clues",
  );
  if (!game) throw new Error("Başlangıç duygu oyunu bulunamadı.");
  return game;
}

const initialEmotionGame = getInitialEmotionGame();

function getInitialFishGame(): FishPatternsGame {
  const game = content.games?.find(
    (candidate): candidate is FishPatternsGame => candidate.mechanic === "fish_patterns",
  );
  if (!game) throw new Error("Başlangıç balık oyunu bulunamadı.");
  return game;
}

const initialFishGame = getInitialFishGame();

function getInitialBalloonGame(): BalloonCountingGame {
  const game = content.games?.find(
    (candidate): candidate is BalloonCountingGame => candidate.mechanic === "balloon_counting",
  );
  if (!game) throw new Error("Başlangıç balon oyunu bulunamadı.");
  return game;
}

const initialBalloonGame = getInitialBalloonGame();
const initialMiniGames = (content.games ?? []).filter(
  (candidate): candidate is MiniChallengeGame => candidate.mechanic === "mini_challenge",
);

const DRAFT_STORAGE_KEY = "adaptive-admin-tap-or-wait-draft-v1";

interface GameCatalogItem {
  game: Game;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  bundled?: boolean;
}

function GameCatalog({
  items,
  loading,
  onEdit,
  onApprove,
  onArchive,
  recentlyPublishedId,
}: {
  items: GameCatalogItem[];
  loading: boolean;
  onEdit: (game: Game) => void;
  onApprove: (game: Game) => void;
  onArchive: (gameId: string) => void;
  recentlyPublishedId: string | null;
}) {
  const [expandedStatus, setExpandedStatus] = useState<GameCatalogItem["status"] | null>(null);
  const groups = [
    { status: "draft" as const, title: "Onay Bekleyenler" },
    { status: "published" as const, title: "Yayındakiler" },
    { status: "archived" as const, title: "Arşivlenenler" },
  ];
  useEffect(() => {
    if (recentlyPublishedId) setExpandedStatus("published");
  }, [recentlyPublishedId]);
  return (
    <section className="game-catalog" aria-label="Oyun kataloğu">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.status === group.status);
        return (
          <div
            className={`game-catalog-group ${expandedStatus === group.status ? "expanded" : ""}`}
            key={group.status}
          >
            <button
              aria-expanded={expandedStatus === group.status}
              className="game-catalog-heading"
              onClick={() =>
                setExpandedStatus((current) => (current === group.status ? null : group.status))
              }
              type="button"
            >
              <h3>{group.title}</h3>
              <span className="game-catalog-count">{groupItems.length}</span>
              <span aria-hidden="true" className="game-catalog-chevron">
                {expandedStatus === group.status ? "−" : "+"}
              </span>
            </button>
            {expandedStatus === group.status ? (
              <div className="game-catalog-content">
                {loading ? (
                  <p className="generation-help">Yükleniyor…</p>
                ) : groupItems.length === 0 ? (
                  <p className="game-catalog-empty">
                    {group.status === "draft" ? "Onay bekleyen oyun yok." : "Henüz oyun yok."}
                  </p>
                ) : (
                  groupItems.map((item) => (
                    <article className="game-catalog-item" key={`${group.status}-${item.game.id}`}>
                      <div>
                        <strong>{item.game.title}</strong>
                        {group.status === "published" && item.game.id === recentlyPublishedId ? (
                          <span className="game-sent-status">Gönderildi</span>
                        ) : null}
                        {item.bundled ? (
                          <span className="game-bundled-status">Uygulamayla gelir</span>
                        ) : null}
                        {item.game.productionSource === "automation" ? (
                          <span className="game-automation-status">Otomasyon</span>
                        ) : null}
                        <small>
                          v{item.game.version} ·{" "}
                          {item.game.ageBand === "2-4" ? "2–4 yaş" : "4–7 yaş"}
                        </small>
                      </div>
                      <div className="game-catalog-actions">
                        <button className="quiet" onClick={() => onEdit(item.game)} type="button">
                          Şemayı düzenle
                        </button>
                        {group.status === "draft" ? (
                          <button
                            className="primary"
                            onClick={() => onApprove(item.game)}
                            type="button"
                          >
                            Onayla ve yayınla
                          </button>
                        ) : null}
                        {group.status === "published" && !item.bundled ? (
                          <button
                            className="danger"
                            onClick={() => onArchive(item.game.id)}
                            type="button"
                          >
                            Arşivle
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function updateRule(game: TapOrWaitGame, ruleIndex: number, rule: GameRule): TapOrWaitGame {
  return {
    ...game,
    rules: game.rules.map((current, index) => (index === ruleIndex ? rule : current)),
  };
}

export function GamePanel({ supabase }: { supabase: SupabaseClient | null }) {
  const [game, setGame] = useState<Game>(initialGame);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [catalog, setCatalog] = useState<GameCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [recentlyPublishedId, setRecentlyPublishedId] = useState<string | null>(null);
  const validation = useMemo(() => gameSchema.safeParse(game), [game]);

  const authenticatedRequest = useCallback(
    async (url: string, init?: RequestInit) => {
      if (!supabase) throw new Error("Supabase bağlantısı gerekli.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Yönetici oturumu gerekli.");
      return fetch(url, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` },
      });
    },
    [supabase],
  );

  const loadCatalog = useCallback(async () => {
    if (!supabase) return;
    setCatalogLoading(true);
    try {
      const response = await authenticatedRequest("/api/games");
      const body = (await response.json()) as { error?: string; items?: GameCatalogItem[] };
      if (!response.ok || body.error) throw new Error(body.error ?? "Oyun kataloğu yüklenemedi.");
      const remoteItems = body.items ?? [];
      const knownIds = new Set(remoteItems.map((item) => item.game.id));
      const bundledItems: GameCatalogItem[] = (content.games ?? [])
        .filter(
          (bundledGame) => bundledGame.status === "published" && !knownIds.has(bundledGame.id),
        )
        .map((bundledGame) => ({
          game: bundledGame,
          status: "published",
          updatedAt: content.createdAt,
          bundled: true,
        }));
      setCatalog([...remoteItems, ...bundledItems]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Oyun kataloğu yüklenemedi.");
    } finally {
      setCatalogLoading(false);
    }
  }, [authenticatedRequest, supabase]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const archiveGame = async (gameId: string) => {
    if (!window.confirm("Bu oyun mobil havuzdan kaldırılıp arşivlensin mi?")) return;
    setBusy(true);
    try {
      const response = await authenticatedRequest(
        `/api/games?gameId=${encodeURIComponent(gameId)}`,
        {
          method: "DELETE",
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Oyun arşivlenemedi.");
      setMessage("Oyun mobil havuzdan kaldırıldı ve arşivlendi.");
      await loadCatalog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Oyun arşivlenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const approveGame = async (candidate: Game) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedRequest("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", game: candidate }),
      });
      const body = (await response.json()) as { error?: string; game?: unknown };
      if (!response.ok || body.error) throw new Error(body.error ?? "Oyun onaylanamadı.");
      const publishedGame = gameSchema.parse(body.game);
      setRecentlyPublishedId(publishedGame.id);
      setMessage(`${publishedGame.title} onaylandı ve mobil yayın havuzuna gönderildi.`);
      await loadCatalog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Oyun onaylanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const submitGame = async (event: FormEvent, action: "save" | "publish") => {
    event.preventDefault();
    if (!validation.success) {
      setMessage("Oyun taslağı doğrulanamadı. İşaretlenen alanları kontrol et.");
      return;
    }
    if (!supabase) {
      setMessage("Supabase bağlantısı olmadan oyun kaydedilemez.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedRequest("/api/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, game: validation.data }),
      });
      const body = (await response.json()) as { error?: string; game?: unknown; status?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Oyun kaydedilemedi.");
      const returnedGame = gameSchema.parse(body.game);
      setGame(returnedGame);
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(returnedGame));
      setMessage(
        action === "publish"
          ? `Oyun v${returnedGame.version} mobil yayın havuzuna gönderildi.`
          : `Oyun v${returnedGame.version} onay bekleyenler kuyruğuna eklendi.`,
      );
      if (action === "publish") {
        setRecentlyPublishedId(returnedGame.id);
        setEditorExpanded(false);
      }
      await loadCatalog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Oyun kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const setRoundCount = (roundCount: number) => {
    if (game.mechanic !== "tap_or_wait") return;
    const ruleIds = game.rules.map((rule) => rule.id);
    setGame({
      ...game,
      roundPlan: {
        mode: "manual",
        rounds: Array.from({ length: roundCount }, (_, index) => ({
          ruleId: ruleIds[index % ruleIds.length] ?? ruleIds[0] ?? "",
        })),
      },
    });
  };

  const selectAgeBand = (ageBand: Game["ageBand"]) => {
    if (game.mechanic === "balloon_counting" || game.mechanic === "mini_challenge") return;
    if (game.mechanic === "fish_patterns") {
      const matching = content.games?.find(
        (candidate): candidate is FishPatternsGame =>
          candidate.mechanic === "fish_patterns" && candidate.ageBand === ageBand,
      );
      if (matching) setGame({ ...matching, status: game.status });
      return;
    }
    if (game.mechanic === "tap_or_wait") {
      const rounds =
        ageBand === "2-4" && game.roundPlan.rounds.length > 6
          ? game.roundPlan.rounds.slice(0, 6)
          : game.roundPlan.rounds;
      setGame({
        ...game,
        ageBand,
        roundPlan: { mode: "manual", rounds },
        difficulty: {
          ...game.difficulty,
          ruleChangeEnabled: ageBand === "2-4" ? false : game.difficulty.ruleChangeEnabled,
        },
      });
      return;
    }
    setGame({ ...game, ageBand });
  };

  return (
    <div className="game-panel-stack">
      {!editorExpanded ? (
        <section className="game-create-card">
          <div>
            <p className="eyebrow">YENİ OYUN</p>
            <h2>Yeni bir oyun şeması oluştur</h2>
            <p className="generation-help">
              Mekaniği seçtiğinde hazır alanlar düzenleyicide açılır.
            </p>
          </div>
          <div className="game-template-actions">
            {initialMiniGames.map((miniGame) => (
              <button
                className="game-template-button primary"
                key={miniGame.id}
                onClick={() => {
                  setGame({ ...miniGame, status: "draft" });
                  setEditorExpanded(true);
                  setMessage(`${miniGame.title} şablonu düzenleyiciye yüklendi.`);
                }}
                type="button"
              >
                <strong>{miniGame.title}</strong>
                <span>{miniGame.description}</span>
              </button>
            ))}
            <button
              className="game-template-button primary"
              onClick={() => {
                setGame({ ...initialBalloonGame, status: "draft" });
                setEditorExpanded(true);
                setMessage("Pofi’nin Balon Saymacası şablonu düzenleyiciye yüklendi.");
              }}
              type="button"
            >
              <strong>Pofi’nin Balon Saymacası</strong>
              <span>Say, rengi bul ve sırayla dokun</span>
            </button>
            <button
              className="game-template-button primary"
              onClick={() => {
                setGame({ ...initialFishGame, status: "draft" });
                setEditorExpanded(true);
                setMessage("Bobi'nin Balık Desenleri şablonu düzenleyiciye yüklendi.");
              }}
              type="button"
            >
              <strong>Bobi'nin Balık Desenleri</strong>
              <span>Renk tahmini ve sıra hatırlama</span>
            </button>
            <button
              className="game-template-button primary"
              onClick={() => {
                setGame({ ...initialEmotionGame, status: "draft" });
                setEditorExpanded(true);
                setMessage("Duru Duygu Dedektifi şablonu düzenleyiciye yüklendi.");
              }}
              type="button"
            >
              <strong>Duru Duygu Dedektifi</strong>
              <span>Duyguyu ve görsel ipucunu bul</span>
            </button>
            <button
              className="game-template-button primary"
              onClick={() => {
                setGame({ ...initialRoutineGame, status: "draft" });
                setEditorExpanded(true);
                setMessage("Tomo’nun Rutin Yolu şablonu düzenleyiciye yüklendi.");
              }}
              type="button"
            >
              <strong>Tomo’nun Rutin Yolu</strong>
              <span>Sırala ve yerleştir</span>
            </button>
            <button
              className="game-template-button primary"
              onClick={() => {
                setGame({ ...initialSortGame, status: "draft" });
                setEditorExpanded(true);
                setMessage("Pati’nin Kural Sepeti şablonu düzenleyiciye yüklendi.");
              }}
              type="button"
            >
              <strong>Pati’nin Kural Sepeti</strong>
              <span>Sınıflandır ve sepete taşı</span>
            </button>
            <button
              className="game-template-button quiet"
              onClick={() => {
                setGame({ ...initialGame, status: "draft" });
                setEditorExpanded(true);
                setMessage("Lila’nın Işık Bahçesi şablonu düzenleyiciye yüklendi.");
              }}
              type="button"
            >
              <strong>Lila’nın Işık Bahçesi</strong>
              <span>Işık ve hareket kuralları</span>
            </button>
          </div>
        </section>
      ) : null}
      <GameCatalog
        items={catalog}
        loading={catalogLoading}
        onApprove={(candidate) => void approveGame(candidate)}
        onArchive={(gameId) => void archiveGame(gameId)}
        recentlyPublishedId={recentlyPublishedId}
        onEdit={(selected) => {
          setGame(selected);
          setEditorExpanded(true);
          setMessage(`${selected.title} v${selected.version} düzenleyiciye yüklendi.`);
        }}
      />
      {editorExpanded ? (
        <section className="generation-card game-editor">
          <div className="section-heading">
            <div>
              <p className="eyebrow">OYUN ÜRETİMİ</p>
              <h2>
                {game.mechanic === "tap_or_wait"
                  ? "Dokun veya Bekle"
                  : game.mechanic === "classify_and_sort"
                    ? "Sınıflandır ve Sepete Taşı"
                    : game.mechanic === "sequence_and_place"
                      ? "Sırala ve Yerleştir"
                      : game.mechanic === "emotion_clues"
                        ? "Duygu ve İpucu"
                        : game.mechanic === "fish_patterns"
                          ? "Balık Desenleri"
                          : game.mechanic === "balloon_counting"
                            ? "Balon Saymacası"
                            : "Mini Beceri Oyunu"}
              </h2>
            </div>
            <div className="game-editor-heading-actions">
              <span className={validation.success ? "game-valid" : "game-invalid"}>
                {validation.success ? "Şema geçerli" : "Kontrol gerekli"}
              </span>
              <button className="quiet" onClick={() => setEditorExpanded(false)} type="button">
                Şemayı küçült
              </button>
            </div>
          </div>
          <p className="generation-help">
            Mekaniği seç, yönergeleri düzenle ve aynı şablondan farklı oyunlar yayınla.
          </p>

          <form className="game-form" onSubmit={(event) => void submitGame(event, "save")}>
            <fieldset className="game-age-picker">
              <legend>Yaş grubunu manuel seç</legend>
              <div className="game-age-buttons">
                <button
                  aria-pressed={game.ageBand === "2-4"}
                  className={game.ageBand === "2-4" ? "active" : "quiet"}
                  onClick={() => selectAgeBand("2-4")}
                  type="button"
                >
                  <strong>2–4 yaş</strong>
                  <span>24–47 ay</span>
                </button>
                <button
                  aria-pressed={game.ageBand === "4-7"}
                  className={game.ageBand === "4-7" ? "active" : "quiet"}
                  disabled={
                    game.mechanic === "balloon_counting" || game.mechanic === "mini_challenge"
                  }
                  onClick={() => selectAgeBand("4-7")}
                  type="button"
                >
                  <strong>4–7 yaş</strong>
                  <span>48–83 ay</span>
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend>1. Temel bilgiler</legend>
              <label>
                Oyun mekaniği
                <select
                  onChange={(event) => {
                    setGame(
                      event.target.value === "classify_and_sort"
                        ? initialSortGame
                        : event.target.value === "sequence_and_place"
                          ? initialRoutineGame
                          : event.target.value === "emotion_clues"
                            ? initialEmotionGame
                            : event.target.value === "fish_patterns"
                              ? initialFishGame
                              : event.target.value === "balloon_counting"
                                ? initialBalloonGame
                                : event.target.value === "mini_challenge"
                                  ? (initialMiniGames[0] ?? initialGame)
                                  : initialGame,
                    );
                    setMessage("Mekanik şablonu yüklendi. Alanları düzenleyebilirsin.");
                  }}
                  value={game.mechanic}
                >
                  <option value="tap_or_wait">Dokun veya Bekle</option>
                  <option value="classify_and_sort">Sınıflandır ve Sepete Taşı</option>
                  <option value="sequence_and_place">Sırala ve Yerleştir</option>
                  <option value="emotion_clues">Duygu ve İpucu</option>
                  <option value="fish_patterns">Balık Desenleri</option>
                  <option value="balloon_counting">Balon Saymacası</option>
                  <option value="mini_challenge">Mini Beceri Oyunu</option>
                </select>
              </label>
              <label>
                Oyun adı
                <input
                  maxLength={100}
                  onChange={(event) => setGame({ ...game, title: event.target.value })}
                  value={game.title}
                />
              </label>
              <label>
                Kısa açıklama
                <textarea
                  maxLength={240}
                  onChange={(event) => setGame({ ...game, description: event.target.value })}
                  value={game.description}
                />
              </label>
              <label>
                Başlangıç yönergesi
                <textarea
                  maxLength={240}
                  onChange={(event) => {
                    const introNarration = event.target.value;
                    setGame((current) =>
                      current.mechanic === "tap_or_wait"
                        ? {
                            ...current,
                            presentation: { ...current.presentation, introNarration },
                          }
                        : current.mechanic === "classify_and_sort"
                          ? {
                              ...current,
                              presentation: { ...current.presentation, introNarration },
                            }
                          : {
                              ...current,
                              presentation: { ...current.presentation, introNarration },
                            },
                    );
                  }}
                  value={game.presentation.introNarration}
                />
              </label>
            </fieldset>

            {game.mechanic === "tap_or_wait" ? (
              <>
                <fieldset>
                  <legend>2. Yaş ve tur</legend>
                  <label>
                    Yaş grubu
                    <select
                      onChange={(event) => {
                        const ageBand = event.target.value as TapOrWaitGame["ageBand"];
                        const rounds =
                          ageBand === "2-4" && game.roundPlan.rounds.length > 6
                            ? game.roundPlan.rounds.slice(0, 6)
                            : game.roundPlan.rounds;
                        setGame({
                          ...game,
                          ageBand,
                          roundPlan: { mode: "manual", rounds },
                          difficulty: {
                            ...game.difficulty,
                            ruleChangeEnabled:
                              ageBand === "2-4" ? false : game.difficulty.ruleChangeEnabled,
                          },
                        });
                      }}
                      value={game.ageBand}
                    >
                      <option value="2-4">2–4 yaş · 24–47 ay</option>
                      <option value="4-7">4–7 yaş · 48–83 ay</option>
                    </select>
                  </label>
                  <label>
                    Tur sayısı
                    <input
                      max={game.ageBand === "2-4" ? 6 : 10}
                      min={3}
                      onChange={(event) => setRoundCount(Number(event.target.value))}
                      type="number"
                      value={game.roundPlan.rounds.length}
                    />
                  </label>
                </fieldset>

                <fieldset>
                  <legend>3. Kurallar</legend>
                  <div className="game-rule-grid">
                    {game.rules.map((rule, index) => (
                      <article className="game-rule" key={rule.id}>
                        <div
                          aria-label={rule.stimulus.accessibilityLabel}
                          className="game-signal-preview"
                          style={{ backgroundColor: rule.stimulus.color }}
                        >
                          {rule.stimulus.symbol}
                        </div>
                        <label>
                          Erişilebilir ad
                          <input
                            maxLength={120}
                            onChange={(event) =>
                              setGame(
                                updateRule(game, index, {
                                  ...rule,
                                  stimulus: {
                                    ...rule.stimulus,
                                    accessibilityLabel: event.target.value,
                                  },
                                }),
                              )
                            }
                            value={rule.stimulus.accessibilityLabel}
                          />
                        </label>
                        <label>
                          Yönerge
                          <input
                            maxLength={160}
                            onChange={(event) =>
                              setGame(
                                updateRule(game, index, {
                                  ...rule,
                                  instruction: event.target.value,
                                }),
                              )
                            }
                            value={rule.instruction}
                          />
                        </label>
                        <label>
                          Beklenen davranış
                          <select
                            onChange={(event) => {
                              const expectedAction =
                                event.target.value === "wait_without_tap"
                                  ? ({ type: "wait_without_tap", durationMs: 4_000 } as const)
                                  : ({
                                      type: "tap_count",
                                      count: Number(event.target.value) as 1 | 2,
                                      responseWindowMs: 5_000,
                                    } as const);
                              setGame(updateRule(game, index, { ...rule, expectedAction }));
                            }}
                            value={
                              rule.expectedAction.type === "wait_without_tap"
                                ? "wait_without_tap"
                                : String(rule.expectedAction.count)
                            }
                          >
                            <option value="1">Bir kere dokun</option>
                            <option value="2">İki kere dokun</option>
                            <option value="wait_without_tap">Dokunmadan bekle</option>
                          </select>
                        </label>
                      </article>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>4. Tur sırası</legend>
                  <div className="game-rounds">
                    {game.roundPlan.rounds.map((round, index) => {
                      const rule = game.rules.find((candidate) => candidate.id === round.ruleId);
                      return (
                        <label key={`${round.ruleId}-${index}`}>
                          <span>{index + 1}. tur</span>
                          <select
                            onChange={(event) =>
                              setGame({
                                ...game,
                                roundPlan: {
                                  mode: "manual",
                                  rounds: game.roundPlan.rounds.map((current, roundIndex) =>
                                    roundIndex === index ? { ruleId: event.target.value } : current,
                                  ),
                                },
                              })
                            }
                            value={round.ruleId}
                          >
                            {game.rules.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.stimulus.accessibilityLabel}
                              </option>
                            ))}
                          </select>
                          <span
                            aria-hidden="true"
                            className="game-round-dot"
                            style={{ backgroundColor: rule?.stimulus.color }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </>
            ) : game.mechanic === "classify_and_sort" ? (
              <>
                <fieldset>
                  <legend>2. Yaş ve davranış</legend>
                  <label>
                    Yaş grubu
                    <select
                      onChange={(event) =>
                        setGame({
                          ...game,
                          ageBand: event.target.value as ClassifyAndSortGame["ageBand"],
                        })
                      }
                      value={game.ageBand}
                    >
                      <option value="2-4">2–4 yaş · 24–47 ay</option>
                      <option value="4-7">4–7 yaş · 48–83 ay</option>
                    </select>
                  </label>
                  <label className="game-checkbox">
                    <input
                      checked={game.difficulty.secondTryEnabled}
                      onChange={(event) =>
                        setGame({
                          ...game,
                          difficulty: {
                            ...game.difficulty,
                            secondTryEnabled: event.target.checked,
                          },
                        })
                      }
                      type="checkbox"
                    />
                    İlk hatada ikinci deneme ver
                  </label>
                </fieldset>
                <fieldset>
                  <legend>3. Renk → tür → büyüklük turları</legend>
                  <div className="game-rule-grid">
                    {game.rounds.map((round, index) => (
                      <article className="game-rule" key={round.id}>
                        <strong>{index + 1}. tur</strong>
                        <label>
                          Kural boyutu
                          <select
                            onChange={(event) => {
                              const dimension = event.target.value as typeof round.dimension;
                              const targetValue =
                                dimension === "color"
                                  ? "red"
                                  : dimension === "category"
                                    ? "animal"
                                    : "large";
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index ? { ...item, dimension, targetValue } : item,
                                ),
                              });
                            }}
                            value={round.dimension}
                          >
                            <option value="color">Renk</option>
                            <option value="category">Tür</option>
                            <option value="size">Büyüklük</option>
                          </select>
                        </label>
                        <label>
                          Yönerge
                          <input
                            maxLength={160}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, instruction: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.instruction}
                          />
                        </label>
                        <small>{round.objects.length} çizimli nesne · 1 doğru hedef</small>
                      </article>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : game.mechanic === "sequence_and_place" ? (
              <>
                <fieldset>
                  <legend>2. Yaş ve destek</legend>
                  <label>
                    Yaş grubu
                    <select
                      onChange={(event) =>
                        setGame({
                          ...game,
                          ageBand: event.target.value as SequenceAndPlaceGame["ageBand"],
                        })
                      }
                      value={game.ageBand}
                    >
                      <option value="2-4">2–4 yaş · iki adımlı</option>
                      <option value="4-7">4–7 yaş · iki veya üç adımlı</option>
                    </select>
                  </label>
                  <label>
                    İpucu bekleme süresi (ms)
                    <input
                      max={30000}
                      min={5000}
                      onChange={(event) =>
                        setGame({
                          ...game,
                          difficulty: {
                            ...game.difficulty,
                            hintDelayMs: Number(event.target.value),
                          },
                        })
                      }
                      type="number"
                      value={game.difficulty.hintDelayMs}
                    />
                  </label>
                </fieldset>
                <fieldset>
                  <legend>3. Rutin turları</legend>
                  <div className="game-rule-grid">
                    {game.rounds.map((round, index) => (
                      <article className="game-rule" key={round.id}>
                        <strong>
                          {index + 1}. tur · {round.items.length} adım
                        </strong>
                        <label>
                          Sesli yönerge
                          <textarea
                            maxLength={180}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, instruction: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.instruction}
                          />
                        </label>
                        <small>
                          Doğru sıra:{" "}
                          {round.correctOrder
                            .map((itemId) => round.items.find((item) => item.id === itemId)?.label)
                            .join(" → ")}
                        </small>
                      </article>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : game.mechanic === "emotion_clues" ? (
              <>
                <fieldset>
                  <legend>2. Yaş ve destek</legend>
                  <label>
                    Yaş grubu
                    <select
                      onChange={(event) =>
                        setGame({
                          ...game,
                          ageBand: event.target.value as EmotionCluesGame["ageBand"],
                        })
                      }
                      value={game.ageBand}
                    >
                      <option value="2-4">2–4 yaş · temel duygu ve ipucu</option>
                      <option value="4-7">4–7 yaş · duygu ve beden ipucu</option>
                    </select>
                  </label>
                  <label className="game-checkbox">
                    <input
                      checked={game.difficulty.askClueQuestion}
                      onChange={(event) =>
                        setGame({
                          ...game,
                          difficulty: {
                            ...game.difficulty,
                            askClueQuestion: event.target.checked,
                          },
                        })
                      }
                      type="checkbox"
                    />
                    Duygudan sonra görsel ipucunu sor
                  </label>
                </fieldset>
                <fieldset>
                  <legend>3. Duygu sahneleri</legend>
                  <div className="game-rule-grid">
                    {game.rounds.map((round, index) => (
                      <article className="game-rule" key={round.id}>
                        <strong>{index + 1}. sahne</strong>
                        <label>
                          Kısa olay
                          <textarea
                            maxLength={180}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, storyPrompt: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.storyPrompt}
                          />
                        </label>
                        <label>
                          Duygu sorusu
                          <input
                            maxLength={140}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, emotionPrompt: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.emotionPrompt}
                          />
                        </label>
                        <label>
                          İpucu sorusu
                          <input
                            maxLength={160}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, cluePrompt: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.cluePrompt}
                          />
                        </label>
                        <small>
                          Doğru duygu: {round.correctEmotion} · ipucu: {round.correctClue}
                        </small>
                      </article>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : game.mechanic === "fish_patterns" ? (
              <>
                <fieldset>
                  <legend>2. Yaş ve tur tipi</legend>
                  <label>
                    Yaş grubu
                    <select
                      onChange={(event) => {
                        const ageBand = event.target.value as FishPatternsGame["ageBand"];
                        const matching = content.games?.find(
                          (candidate): candidate is FishPatternsGame =>
                            candidate.mechanic === "fish_patterns" && candidate.ageBand === ageBand,
                        );
                        if (matching) setGame({ ...matching, status: "draft" });
                      }}
                      value={game.ageBand}
                    >
                      <option value="2-4">2–4 yaş · renk tahmini</option>
                      <option value="4-7">4–7 yaş · sıra hatırlama</option>
                    </select>
                  </label>
                  <p className="generation-help">
                    Yaşa göre tur tipi ve balık sayısı otomatik sınırlandırılır.
                  </p>
                </fieldset>
                <fieldset>
                  <legend>3. Balık turları</legend>
                  <div className="game-rule-grid">
                    {game.rounds.map((round, index) => (
                      <article className="game-rule" key={round.id}>
                        <strong>
                          {index + 1}. tur ·{" "}
                          {round.kind === "color_prediction" ? "Renk tahmini" : "Sıra hatırlama"}
                        </strong>
                        <label>
                          Yönerge
                          <input
                            maxLength={160}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, prompt: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.prompt}
                          />
                        </label>
                        <small>{round.sequence.length} balık · ikinci deneme açık</small>
                      </article>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : game.mechanic === "balloon_counting" ? (
              <>
                <fieldset>
                  <legend>2. Yaş ve destek</legend>
                  <p className="generation-help">
                    Bu mekanik 2–4 yaş için en fazla 5 balon ve 1–3 hedefle sınırlandırılır.
                  </p>
                </fieldset>
                <fieldset>
                  <legend>3. Balon turları</legend>
                  <div className="game-rule-grid">
                    {game.rounds.map((round, index) => (
                      <article className="game-rule" key={round.id}>
                        <strong>
                          {index + 1}. tur · {round.kind}
                        </strong>
                        <label>
                          Yönerge
                          <input
                            maxLength={160}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, prompt: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.prompt}
                          />
                        </label>
                        <small>
                          {round.balloons.length} balon · hedef {round.targetCount}
                        </small>
                      </article>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : (
              <>
                <fieldset>
                  <legend>2. Yaş ve destek</legend>
                  <p className="generation-help">
                    Bu oyun 2–4 yaş için kısa, en fazla üç adımlı turlardan oluşur.
                  </p>
                </fieldset>
                <fieldset>
                  <legend>3. Beceri turları</legend>
                  <div className="game-rule-grid">
                    {game.rounds.map((round, index) => (
                      <article className="game-rule" key={round.id}>
                        <strong>
                          {index + 1}. tur · {round.kind}
                        </strong>
                        <label>
                          Yönerge
                          <input
                            maxLength={180}
                            onChange={(event) =>
                              setGame({
                                ...game,
                                rounds: game.rounds.map((item, roundIndex) =>
                                  roundIndex === index
                                    ? { ...item, prompt: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            value={round.prompt}
                          />
                        </label>
                        <small>
                          {round.choices.length} seçenek · {round.correctSequence.length} adım
                        </small>
                      </article>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {!validation.success ? (
              <div className="game-errors" role="alert">
                {validation.error.issues.slice(0, 4).map((issue) => (
                  <p key={`${issue.path.join(".")}-${issue.message}`}>{issue.message}</p>
                ))}
              </div>
            ) : null}
            {message ? <p className="alert">{message}</p> : null}
            <div className="game-actions">
              <button disabled={busy || !validation.success} type="submit">
                {busy ? "Onaya gönderiliyor…" : "Onay bekleyenlere gönder"}
              </button>
              <button
                className="primary"
                disabled={busy || !validation.success}
                onClick={(event) => void submitGame(event, "publish")}
                type="button"
              >
                {busy ? "Gönderiliyor…" : "Mobil yayın havuzuna gönder"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
