import { type AgeBand, type Game, gameSchema } from "@adaptive/content-schema";

export type PublishedGameRow = {
  game_id: string;
  game_version: number;
  game: unknown;
};

const hiddenDuplicateGameIds = new Set(["auto-15c5cc92-6023-4465-b57e-452aa746050f"]);

function normalizePublishedTitle(game: Game): Game {
  if (!game.id.startsWith("auto-")) return game;
  return { ...game, title: game.title.replace(/\s*·\s*yeni taslak\s*$/iu, "") } as Game;
}

export function mergePublishedGames(
  ageBand: AgeBand,
  fallbackGames: Game[],
  publishedRows: PublishedGameRow[],
  deletedGameIds: ReadonlySet<string>,
): Game[] {
  const latestById = new Map<string, Game>();
  for (const row of publishedRows) {
    if (deletedGameIds.has(row.game_id) || hiddenDuplicateGameIds.has(row.game_id)) continue;
    if (latestById.has(row.game_id)) continue;
    const parsed = gameSchema.safeParse(row.game);
    if (
      !parsed.success ||
      parsed.data.status !== "published" ||
      parsed.data.id !== row.game_id ||
      parsed.data.version !== row.game_version
    ) {
      continue;
    }
    latestById.set(row.game_id, normalizePublishedTitle(parsed.data));
  }

  const bundledGames = fallbackGames.filter(
    (game) => game.ageBand === ageBand && !deletedGameIds.has(game.id),
  );
  const bundledIds = new Set(bundledGames.map((game) => game.id));
  const mergedBundledGames = bundledGames.map((bundledGame) => {
    const remoteGame = latestById.get(bundledGame.id);
    return remoteGame && remoteGame.version >= bundledGame.version ? remoteGame : bundledGame;
  });
  const remoteOnlyGames = [...latestById.values()].filter(
    (game) => game.ageBand === ageBand && !bundledIds.has(game.id),
  );

  return [...mergedBundledGames, ...remoteOnlyGames];
}
