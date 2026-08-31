import type { AgeBand, Game } from "@adaptive/content-schema";
import { supabase } from "../lib/supabase";
import { mergePublishedGames, type PublishedGameRow } from "./gameCatalogMerge";

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

  return mergePublishedGames(
    ageBand,
    fallbackGames,
    (publishedResult.data ?? []) as PublishedGameRow[],
    deletedGameIds,
  );
}
