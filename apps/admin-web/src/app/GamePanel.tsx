"use client";

import {
  type AgeBand,
  type BalloonCountingGame,
  type ClassifyAndSortGame,
  contentVersionSchema,
  type EmotionCluesGame,
  type FishPatternsGame,
  type Game,
  type GameDifficultyLevel,
  type GameMechanic,
  type GameRule,
  gameSchema,
  type MiniChallengeGame,
  type SequenceAndPlaceGame,
  type TapOrWaitGame,
} from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  getApprovedAutomationTemplatesForAge,
  getApprovedDifficultyOptions,
} from "../lib/gameAutomation";

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
const approvedAutomationTemplates = (content.games ?? []).filter(
  (candidate) => candidate.status === "published",
);

const DRAFT_STORAGE_KEY = "adaptive-admin-tap-or-wait-draft-v1";
const difficultyLabels: Record<GameDifficultyLevel, string> = {
  starter: "Başlangıç",
  growing: "Gelişen",
  advanced: "İleri",
};
const mechanicLabels: Record<GameMechanic, string> = {
  tap_or_wait: "Dokun veya bekle",
  classify_and_sort: "Sınıflandır",
  sequence_and_place: "Sırala",
  emotion_clues: "Duygu ipuçları",
  fish_patterns: "Balık desenleri",
  balloon_counting: "Balon sayma",
  mini_challenge: "Mini görev",
};

interface GameCatalogItem {
  game: Game;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  bundled?: boolean;
}

interface GameCatalogFilters {
  age: AgeBand | "all";
  mechanic: GameMechanic | "all";
  difficulty: GameDifficultyLevel | "all";
}

const defaultGameCatalogFilters: GameCatalogFilters = {
  age: "all",
  mechanic: "all",
  difficulty: "all",
};

const catalogGroups = [
  { status: "draft" as const, title: "Onay Bekleyenler" },
  { status: "published" as const, title: "Yayındakiler" },
  { status: "archived" as const, title: "Arşivlenenler" },
];

function isBktGame(game: Game): game is SequenceAndPlaceGame {
  return game.mechanic === "sequence_and_place" && game.leveling?.strategy === "bkt";
}

function GameCatalogFilterBar({
  value,
  onChange,
  onApply,
}: {
  value: GameCatalogFilters;
  onChange: (filters: GameCatalogFilters) => void;
  onApply: () => void;
}) {
  return (
    <section className="game-catalog-filter-bar" aria-label="Oyun kataloğu filtreleri">
      <div>
        <p className="eyebrow">OYUN KATALOĞU</p>
        <h2>İçerikleri filtrele</h2>
      </div>
      <div className="game-catalog-filters">
        <label>
          Yaş grubu
          <select
            value={value.age}
            onChange={(event) => onChange({ ...value, age: event.target.value as AgeBand | "all" })}
          >
            <option value="all">Tümü</option>
            <option value="2-4">2–4 yaş</option>
            <option value="4-7">4–7 yaş</option>
          </select>
        </label>
        <label>
          Mekanik
          <select
            value={value.mechanic}
            onChange={(event) =>
              onChange({ ...value, mechanic: event.target.value as GameMechanic | "all" })
            }
          >
            <option value="all">Tümü</option>
            {Object.entries(mechanicLabels).map(([optionValue, label]) => (
              <option key={optionValue} value={optionValue}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zorluk
          <select
            value={value.difficulty}
            onChange={(event) =>
              onChange({
                ...value,
                difficulty: event.target.value as GameDifficultyLevel | "all",
              })
            }
          >
            <option value="all">Tümü</option>
            {Object.entries(difficultyLabels).map(([optionValue, label]) => (
              <option key={optionValue} value={optionValue}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary game-filter-apply" onClick={onApply} type="button">
          Uygula
        </button>
      </div>
    </section>
  );
}

function GameCatalog({
  items,
  filters,
  loading,
  onOpen,
  showFilteredItems,
}: {
  items: GameCatalogItem[];
  filters: GameCatalogFilters;
  loading: boolean;
  onOpen: (status: GameCatalogItem["status"]) => void;
  showFilteredItems: boolean;
}) {
  const filteredItems = items.filter(
    (item) =>
      (filters.age === "all" || item.game.ageBand === filters.age) &&
      (filters.mechanic === "all" || item.game.mechanic === filters.mechanic) &&
      (filters.difficulty === "all" || item.game.difficulty.level === filters.difficulty),
  );
  return (
    <section className="game-catalog" aria-label="Oyun kataloğu">
      <div className="game-catalog-groups">
        {catalogGroups.map((group) => {
          const groupItems = filteredItems.filter((item) => item.status === group.status);
          return (
            <button
              className="game-catalog-group game-catalog-summary-card"
              disabled={loading}
              key={group.status}
              onClick={() => onOpen(group.status)}
              type="button"
            >
              <span>
                <strong>{group.title}</strong>
                <small>{loading ? "Yükleniyor…" : `${groupItems.length} içerik`}</small>
              </span>
              <span className="game-catalog-count">{groupItems.length}</span>
              <span aria-hidden="true" className="game-catalog-open-icon">
                →
              </span>
            </button>
          );
        })}
      </div>
      {showFilteredItems ? (
        <div aria-live="polite" className="game-filter-results">
          <div className="game-filter-results-heading">
            <div>
              <p className="eyebrow">FİLTRE SONUÇLARI</p>
              <h3>
                {loading ? "İçerikler yükleniyor…" : `${filteredItems.length} içerik bulundu`}
              </h3>
            </div>
            <small>Bir içeriğe dokunarak bulunduğu katalog sayfasını açabilirsin.</small>
          </div>
          {!loading && filteredItems.length === 0 ? (
            <p className="game-catalog-empty">Seçilen filtrelerle eşleşen oyun bulunamadı.</p>
          ) : null}
          {!loading && filteredItems.length > 0 ? (
            <div className="game-filter-results-grid">
              {filteredItems.map((item) => (
                <button
                  className="game-filter-result"
                  key={`${item.status}-${item.game.id}`}
                  onClick={() => onOpen(item.status)}
                  type="button"
                >
                  <strong>{item.game.title}</strong>
                  <span>{catalogGroups.find((group) => group.status === item.status)?.title}</span>
                  <small>
                    {item.game.ageBand === "2-4" ? "2–4 yaş" : "4–7 yaş"} ·{" "}
                    {mechanicLabels[item.game.mechanic]} ·{" "}
                    {difficultyLabels[item.game.difficulty.level]}
                  </small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function GameCatalogPage({
  status,
  items,
  filters,
  loading,
  onBack,
  onEdit,
  onApprove,
  onArchive,
  onDeleteDraft,
  recentlyPublishedId,
}: {
  status: GameCatalogItem["status"];
  items: GameCatalogItem[];
  filters: GameCatalogFilters;
  loading: boolean;
  onBack: () => void;
  onEdit: (game: Game) => void;
  onApprove: (game: Game) => void;
  onArchive: (gameId: string) => void;
  onDeleteDraft: (gameId: string) => void;
  recentlyPublishedId: string | null;
}) {
  const group = catalogGroups.find((candidate) => candidate.status === status);
  const visibleItems = items.filter(
    (item) =>
      item.status === status &&
      (filters.age === "all" || item.game.ageBand === filters.age) &&
      (filters.mechanic === "all" || item.game.mechanic === filters.mechanic) &&
      (filters.difficulty === "all" || item.game.difficulty.level === filters.difficulty),
  );

  return (
    <section className="game-catalog-page" aria-label={group?.title ?? "Oyun kataloğu"}>
      <header className="game-catalog-page-heading">
        <button className="quiet" onClick={onBack} type="button">
          ← Oyun üretimine dön
        </button>
        <div>
          <p className="eyebrow">OYUN KATALOĞU</p>
          <h2>{group?.title}</h2>
          <p>{visibleItems.length} içerik gösteriliyor.</p>
        </div>
      </header>
      {loading ? (
        <p className="generation-help">Yükleniyor…</p>
      ) : visibleItems.length === 0 ? (
        <p className="game-catalog-empty">
          {status === "draft" ? "Onay bekleyen oyun yok." : "Bu filtrelerde oyun yok."}
        </p>
      ) : (
        <div className="game-catalog-page-grid">
          {visibleItems.map((item) => (
            <article className="game-catalog-item" key={`${status}-${item.game.id}`}>
              <div>
                <strong>
                  {item.game.title}
                  {isBktGame(item.game) ? " (BKT)" : ""}
                </strong>
                {status === "published" && item.game.id === recentlyPublishedId ? (
                  <span className="game-sent-status">Gönderildi</span>
                ) : null}
                {item.bundled ? (
                  <span className="game-bundled-status">Uygulamayla gelir</span>
                ) : null}
                {item.game.productionSource === "automation" ? (
                  <span className="game-automation-status">Otomasyon</span>
                ) : null}
                <small>
                  v{item.game.version} · {item.game.ageBand === "2-4" ? "2–4 yaş" : "4–7 yaş"} ·{" "}
                  {difficultyLabels[item.game.difficulty.level]}
                </small>
              </div>
              <div className="game-catalog-actions">
                <button className="quiet" onClick={() => onEdit(item.game)} type="button">
                  Şemayı düzenle
                </button>
                {status === "draft" ? (
                  <>
                    <button className="primary" onClick={() => onApprove(item.game)} type="button">
                      Onayla ve yayınla
                    </button>
                    <button
                      className="danger"
                      onClick={() => onDeleteDraft(item.game.id)}
                      type="button"
                    >
                      Taslağı sil
                    </button>
                  </>
                ) : null}
                {status === "published" && !item.bundled ? (
                  <button className="danger" onClick={() => onArchive(item.game.id)} type="button">
                    Arşivle
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
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
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [newGameSchemaExpanded, setNewGameSchemaExpanded] = useState(true);
  const [catalog, setCatalog] = useState<GameCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [recentlyPublishedId, setRecentlyPublishedId] = useState<string | null>(null);
  const [pendingCatalogFilters, setPendingCatalogFilters] =
    useState<GameCatalogFilters>(defaultGameCatalogFilters);
  const [appliedCatalogFilters, setAppliedCatalogFilters] =
    useState<GameCatalogFilters>(defaultGameCatalogFilters);
  const [catalogFiltersApplied, setCatalogFiltersApplied] = useState(false);
  const [catalogPageStatus, setCatalogPageStatus] = useState<GameCatalogItem["status"] | null>(
    null,
  );
  const [automationAge, setAutomationAge] = useState<AgeBand>("2-4");
  const [automationTemplateId, setAutomationTemplateId] = useState(initialFishGame.id);
  const [automationDifficulty, setAutomationDifficulty] = useState<GameDifficultyLevel>("starter");
  const availableAutomationTemplates = getApprovedAutomationTemplatesForAge(
    approvedAutomationTemplates,
    automationAge,
  );
  const selectedAutomationTemplate =
    availableAutomationTemplates.find((template) => template.id === automationTemplateId) ??
    availableAutomationTemplates[0];
  const automationMechanic = selectedAutomationTemplate?.mechanic ?? "fish_patterns";
  const availableAutomationDifficulties = selectedAutomationTemplate
    ? getApprovedDifficultyOptions(selectedAutomationTemplate)
    : [];
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
      const body = (await response.json()) as {
        error?: string;
        items?: GameCatalogItem[];
      };
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
      setCatalogError(null);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Oyun kataloğu yüklenemedi.");
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

  const deleteDraft = async (gameId: string) => {
    if (!window.confirm("Bu taslak kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedRequest(
        `/api/games?gameId=${encodeURIComponent(gameId)}&catalogStatus=draft`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Taslak silinemedi.");
      setMessage("Taslak kalıcı olarak silindi.");
      await loadCatalog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Taslak silinemedi.");
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

  const generateAutomationDraft = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedRequest("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          ageBand: automationAge,
          mechanic: automationMechanic,
          difficulty: automationDifficulty,
          templateId: selectedAutomationTemplate?.id,
        }),
      });
      const body = (await response.json()) as { error?: string; game?: unknown };
      if (!response.ok || body.error) throw new Error(body.error ?? "Otomatik taslak üretilemedi.");
      const generated = gameSchema.parse(body.game);
      setGame(generated);
      setEditorExpanded(true);
      setMessage("Taslak güvenli parametrelerle üretildi ve onay kuyruğuna eklendi.");
      await loadCatalog();
      window.setTimeout(() => {
        document
          .getElementById("game-editor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Otomatik taslak üretilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const generateBktLevelSet = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedRequest("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_bkt_set",
          ageBand: automationAge,
        }),
      });
      const body = (await response.json()) as { error?: string; games?: unknown[] };
      if (!response.ok || body.error) {
        throw new Error(body.error ?? "BKT seviye seti üretilemedi.");
      }
      const generated = (body.games ?? []).map((candidate) => gameSchema.parse(candidate));
      if (generated.length !== 3) throw new Error("BKT seviye seti eksik üretildi.");
      const starter = generated.find((candidate) => candidate.difficulty.level === "starter");
      if (starter) setGame(starter);
      setEditorExpanded(false);
      setMessage("Tomo için 5, 8 ve 12 turluk üç BKT seviyesi onay bekleyenlere eklendi.");
      await loadCatalog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "BKT seviye seti üretilemedi.");
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

  if (catalogPageStatus) {
    return (
      <div className="game-panel-stack game-catalog-route">
        <GameCatalogFilterBar
          onApply={() => {
            setAppliedCatalogFilters({ ...pendingCatalogFilters });
            setCatalogFiltersApplied(true);
          }}
          onChange={(filters) => {
            setPendingCatalogFilters(filters);
            setCatalogFiltersApplied(false);
          }}
          value={pendingCatalogFilters}
        />
        {message ? (
          <p className="alert game-panel-message" role="status">
            {message}
          </p>
        ) : null}
        {catalogError ? (
          <p className="alert game-panel-message" role="alert">
            {catalogError}
          </p>
        ) : null}
        <GameCatalogPage
          filters={appliedCatalogFilters}
          items={catalog}
          loading={catalogLoading}
          onApprove={(candidate) => void approveGame(candidate)}
          onArchive={(gameId) => void archiveGame(gameId)}
          onBack={() => setCatalogPageStatus(null)}
          onEdit={(selected) => {
            setCatalogPageStatus(null);
            setGame(selected);
            setEditorExpanded(true);
            setMessage(`${selected.title} v${selected.version} düzenleyiciye yüklendi.`);
          }}
          onDeleteDraft={(gameId) => void deleteDraft(gameId)}
          recentlyPublishedId={recentlyPublishedId}
          status={catalogPageStatus}
        />
      </div>
    );
  }

  return (
    <div className="game-panel-stack">
      <GameCatalogFilterBar
        onApply={() => {
          setAppliedCatalogFilters({ ...pendingCatalogFilters });
          setCatalogFiltersApplied(true);
        }}
        onChange={(filters) => {
          setPendingCatalogFilters(filters);
          setCatalogFiltersApplied(false);
        }}
        value={pendingCatalogFilters}
      />
      {message ? (
        <p className="alert game-panel-message" role="status">
          {message}
        </p>
      ) : null}
      {catalogError ? (
        <p className="alert game-panel-message" role="alert">
          {catalogError}
        </p>
      ) : null}
      {!editorExpanded ? (
        <section className={`game-create-card ${newGameSchemaExpanded ? "" : "collapsed"}`}>
          <div className="game-create-heading">
            <div>
              <p className="eyebrow">YENİ OYUN</p>
              <h2>Yeni bir oyun şeması oluştur</h2>
              {newGameSchemaExpanded ? (
                <p className="generation-help">
                  Mekaniği seçtiğinde hazır alanlar düzenleyicide açılır.
                </p>
              ) : null}
            </div>
            <button
              aria-expanded={newGameSchemaExpanded}
              className="quiet"
              onClick={() => setNewGameSchemaExpanded((current) => !current)}
              type="button"
            >
              {newGameSchemaExpanded ? "Küçült" : "Genişlet"}
            </button>
          </div>
          {newGameSchemaExpanded ? (
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
                <strong>Tomo’nun Rutin Yolu (BKT)</strong>
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
          ) : null}
        </section>
      ) : null}
      <section className="game-automation-card">
        <div>
          <p className="eyebrow">GÜVENLİ OTOMASYON</p>
          <h2>Onaylı şablondan taslak üret</h2>
          <p className="generation-help">
            Yalnızca uygulamadaki mekanikler, asset’ler ve doğrulanmış parametreler kullanılır.
            Üretilen oyun doğrudan yayınlanmaz.
          </p>
        </div>
        <div className="game-automation-controls">
          <label>
            Yaş
            <select
              value={automationAge}
              onChange={(event) => {
                const ageBand = event.target.value as AgeBand;
                setAutomationAge(ageBand);
              }}
            >
              <option value="2-4">2–4</option>
              <option value="4-7">4–7</option>
            </select>
          </label>
          <label>
            Oyun şablonu
            <select
              value={selectedAutomationTemplate?.id ?? ""}
              onChange={(event) => {
                const template = availableAutomationTemplates.find(
                  (candidate) => candidate.id === event.target.value,
                );
                if (!template) return;
                setAutomationTemplateId(template.id);
                const difficultyOptions = getApprovedDifficultyOptions(template);
                setAutomationDifficulty((current) =>
                  difficultyOptions.includes(current) ? current : difficultyOptions[0],
                );
              }}
            >
              {availableAutomationTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                  {template.mechanic === "sequence_and_place" ? " (BKT)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Zorluk
            <select
              key={selectedAutomationTemplate?.id ?? "no-template"}
              value={automationDifficulty}
              onChange={(event) =>
                setAutomationDifficulty(event.target.value as GameDifficultyLevel)
              }
            >
              {availableAutomationDifficulties.map((value) => (
                <option key={value} value={value}>
                  {difficultyLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void (automationMechanic === "sequence_and_place"
                ? generateBktLevelSet()
                : generateAutomationDraft())
            }
            type="button"
          >
            {busy
              ? "Taslak oluşturuluyor…"
              : automationMechanic === "sequence_and_place"
                ? "3 seviyeyi oluştur"
                : "Taslak oluştur"}
          </button>
        </div>
      </section>
      <GameCatalog
        filters={appliedCatalogFilters}
        items={catalog}
        loading={catalogLoading}
        onOpen={setCatalogPageStatus}
        showFilteredItems={catalogFiltersApplied}
      />
      {editorExpanded ? (
        <section className="generation-card game-editor" id="game-editor">
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
