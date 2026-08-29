import type { AgeBand, GameDifficultyLevel, GameMechanic } from "@adaptive/content-schema";
import {
  type GameVariantDecision,
  gameVariantDecisionSchema,
} from "@adaptive/personalization-engine";
import { requireSupabase } from "../lib/supabase";

export async function loadGameVariantPreference(
  childId: string,
  ageBand: AgeBand,
  currentDifficulty: GameDifficultyLevel,
  mechanic: GameMechanic,
): Promise<GameVariantDecision> {
  const { data, error } =
    mechanic === "sequence_and_place"
      ? await requireSupabase().rpc("select_bkt_routine_variant", {
          child_profile_id: childId,
          requested_age_band: ageBand,
          current_difficulty: currentDifficulty,
        })
      : await requireSupabase().rpc("select_game_variant_preference", {
          child_profile_id: childId,
          requested_age_band: ageBand,
          current_difficulty: currentDifficulty,
        });
  if (error) throw error;
  return gameVariantDecisionSchema.parse(data);
}
