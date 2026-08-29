import type { Game, GameMechanic } from "@adaptive/content-schema";

export type OlderGameWorldId = "workshop" | "pattern_sea" | "feelings" | "movement";

export const CONTENT_PAGE_SIZE = 4;

const worldByMechanic: Record<GameMechanic, OlderGameWorldId> = {
  momo_workshop: "workshop",
  balloon_counting: "workshop",
  sequence_and_place: "workshop",
  fish_patterns: "pattern_sea",
  classify_and_sort: "pattern_sea",
  mini_challenge: "pattern_sea",
  emotion_clues: "feelings",
  tap_or_wait: "movement",
};

export function getOlderGameWorld(game: Game): OlderGameWorldId {
  return worldByMechanic[game.mechanic];
}

export function groupOlderGames(games: Game[]): Map<OlderGameWorldId, Game[]> {
  const groups = new Map<OlderGameWorldId, Game[]>();
  for (const game of games) {
    const worldId = getOlderGameWorld(game);
    groups.set(worldId, [...(groups.get(worldId) ?? []), game]);
  }
  return groups;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSessionOrder<T>(
  items: T[],
  getId: (item: T) => string,
  recommendedId: string | null,
  sessionSeed: string,
): T[] {
  return [...items].sort((left, right) => {
    const leftId = getId(left);
    const rightId = getId(right);
    if (leftId === recommendedId) return -1;
    if (rightId === recommendedId) return 1;

    const scoreDifference =
      hashString(`${sessionSeed}:${leftId}`) - hashString(`${sessionSeed}:${rightId}`);
    return scoreDifference === 0 ? leftId.localeCompare(rightId) : scoreDifference;
  });
}

export function getContentPage<T>(items: T[], page: number, pageSize = CONTENT_PAGE_SIZE): T[] {
  if (items.length === 0 || pageSize <= 0) return [];
  const pageCount = getContentPageCount(items.length, pageSize);
  const normalizedPage = ((page % pageCount) + pageCount) % pageCount;
  const start = normalizedPage * pageSize;
  return items.slice(start, start + pageSize);
}

export function getContentPageCount(total: number, pageSize = CONTENT_PAGE_SIZE): number {
  if (total <= 0 || pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}
