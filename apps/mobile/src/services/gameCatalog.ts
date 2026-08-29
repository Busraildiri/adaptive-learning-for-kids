import { type AgeBand, type Game, gameSchema } from "@adaptive/content-schema";
import { supabase } from "../lib/supabase";

export async function loadPublishedGames(ageBand: AgeBand, fallbackGames: Game[]): Promise<Game[]> {
  if (!supabase) return fallbackGames.filter((game) => game.ageBand === ageBand);

  const { data, error } = await supabase
    .from("published_game_versions")
    .select("game_id, game_version, game")
    .order("game_id", { ascending: true })
    .order("game_version", { ascending: false });
  if (error) return fallbackGames.filter((game) => game.ageBand === ageBand);

  const latestById = new Map<string, Game>();
  for (const row of data) {
    if (latestById.has(row.game_id)) continue;
    const parsed = gameSchema.safeParse(row.game);
    if (!parsed.success || parsed.data.status !== "published") continue;
    latestById.set(row.game_id, parsed.data);
  }

  const bundledGames = fallbackGames.filter((game) => game.ageBand === ageBand);
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
