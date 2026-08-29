import { type AgeBand, type Game, gameSchema } from "@adaptive/content-schema";
import { supabase } from "../lib/supabase";

export async function loadPublishedGames(ageBand: AgeBand, fallbackGames: Game[]): Promise<Game[]> {
  if (!supabase) return fallbackGames.filter((game) => game.ageBand === ageBand);

  const [publishedResult, tombstoneResult] = await Promise.all([
    supabase
      .from("published_game_versions")
      .select("game_id, game_version, game")
      .order("game_id", { ascending: true })
      .order("game_version", { ascending: false }),
    supabase.from("game_catalog_tombstones").select("game_id"),
  ]);
  if (publishedResult.error) return fallbackGames.filter((game) => game.ageBand === ageBand);

  const deletedGameIds = new Set(
    tombstoneResult.error ? [] : (tombstoneResult.data ?? []).map((row) => row.game_id),
  );

  const latestById = new Map<string, Game>();
  for (const row of publishedResult.data ?? []) {
    if (deletedGameIds.has(row.game_id)) continue;
    if (latestById.has(row.game_id)) continue;
    const parsed = gameSchema.safeParse(row.game);
    if (!parsed.success || parsed.data.status !== "published") continue;
    latestById.set(row.game_id, parsed.data);
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
