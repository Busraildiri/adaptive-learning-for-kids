import { contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { parseGameCatalogRows } from "./gameCatalog";

const games = contentVersionSchema.parse(contentJson).games ?? [];

describe("parseGameCatalogRows", () => {
  it("keeps valid games when one legacy row no longer matches the schema", () => {
    const validGame = games.find((game) => game.id === "piko-pattern-train-001");
    const routineGame = games.find((game) => game.mechanic === "sequence_and_place");
    if (!validGame || routineGame?.mechanic !== "sequence_and_place") {
      throw new Error("Expected bundled game fixtures.");
    }

    const result = parseGameCatalogRows([
      {
        catalog_status: "published",
        updated_at: "2026-08-29T00:00:00.000Z",
        game: validGame,
      },
      {
        catalog_status: "published",
        updated_at: "2026-08-28T00:00:00.000Z",
        game: { ...routineGame, rounds: routineGame.rounds.slice(0, 4) },
      },
    ]);

    expect(result.items.map((item) => item.game.id)).toEqual(["piko-pattern-train-001"]);
    expect(result.skippedInvalidCount).toBe(1);
  });
});
