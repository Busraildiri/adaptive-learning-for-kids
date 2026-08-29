import { type Game, gameSchema } from "@adaptive/content-schema";

export interface ParsedGameCatalogItem {
  game: Game;
  status: "draft" | "published" | "archived";
  updatedAt: string;
}

export function parseGameCatalogRows(rows: Array<Record<string, unknown>>): {
  items: ParsedGameCatalogItem[];
  skippedInvalidCount: number;
} {
  const items: ParsedGameCatalogItem[] = [];
  let skippedInvalidCount = 0;

  for (const row of rows) {
    const status = row.catalog_status;
    const updatedAt = row.updated_at;
    const rawGame = row.game;
    if (
      (status !== "draft" && status !== "published" && status !== "archived") ||
      typeof updatedAt !== "string" ||
      !rawGame ||
      typeof rawGame !== "object" ||
      Array.isArray(rawGame)
    ) {
      skippedInvalidCount += 1;
      continue;
    }

    const parsed = gameSchema.safeParse({
      ...(rawGame as Record<string, unknown>),
      status,
    });
    if (!parsed.success) {
      skippedInvalidCount += 1;
      continue;
    }

    items.push({ game: parsed.data, status, updatedAt });
  }

  return { items, skippedInvalidCount };
}
