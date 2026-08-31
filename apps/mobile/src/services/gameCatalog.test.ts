import { contentVersionSchema, type Game } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { mergePublishedGames } from "./gameCatalogMerge";

const content = contentVersionSchema.parse(contentV1);

describe("game catalog fixture", () => {
  it("contains a published fallback game for ages 2-4", () => {
    expect(content.games).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "color-lights-001",
          ageBand: "2-4",
          status: "published",
          mechanic: "tap_or_wait",
        }),
      ]),
    );
  });

  it("rejects a published row whose payload id does not match its catalog id", () => {
    const toko = content.games?.find((game) => game.id === "toko-little-map-001");
    if (!toko || toko.mechanic !== "mini_challenge") {
      throw new Error("Expected bundled Toko mini challenge");
    }
    const mismatchedDraft = {
      ...toko,
      id: "toko-draft-copy-001",
      title: "Toko’nun Minik Haritası · yeni taslak",
      version: toko.version + 1,
      rounds: [
        {
          ...toko.rounds[0],
          prompt: "Bir adım sağa git.",
          correctSequence: ["right", "right"],
        },
      ],
    } as Game;

    const games = mergePublishedGames(
      "2-4",
      content.games ?? [],
      [
        {
          game_id: toko.id,
          game_version: mismatchedDraft.version,
          game: mismatchedDraft,
        },
      ],
      new Set(),
    );

    expect(games.find((game) => game.id === toko.id)).toEqual(toko);
    expect(games.some((game) => game.id === mismatchedDraft.id)).toBe(false);
  });

  it("keeps an admin-published 4-7 copy and removes its draft title suffix", () => {
    const toko = content.games?.find((game) => game.id === "toko-little-map-001");
    if (!toko || toko.mechanic !== "mini_challenge") {
      throw new Error("Expected bundled Toko mini challenge");
    }
    const autoDraftCopy = {
      ...toko,
      id: "auto-a4d2abba-2d3e-4152-aca0-cd75bbb8e099",
      title: "Toko’nun Minik Haritası · yeni taslak",
      ageBand: "4-7",
      version: 1,
    } as Game;

    const games = mergePublishedGames(
      "4-7",
      content.games ?? [],
      [
        {
          game_id: autoDraftCopy.id,
          game_version: autoDraftCopy.version,
          game: autoDraftCopy,
        },
      ],
      new Set(),
    );

    expect(games.find((game) => game.id === autoDraftCopy.id)).toMatchObject({
      ageBand: "4-7",
      title: "Toko’nun Minik Haritası",
    });
  });

  it("hides the duplicate 4-7 Toko card while keeping the working admin version", () => {
    const toko = content.games?.find((game) => game.id === "toko-little-map-001");
    if (!toko || toko.mechanic !== "mini_challenge") {
      throw new Error("Expected bundled Toko mini challenge");
    }
    const duplicate = {
      ...toko,
      id: "auto-15c5cc92-6023-4465-b57e-452aa746050f",
      title: "Toko’nun Minik Haritası · yeni taslak",
      ageBand: "4-7",
    } as Game;
    const working = {
      ...toko,
      id: "auto-a4d2abba-2d3e-4152-aca0-cd75bbb8e099",
      title: "Toko’nun Minik Haritası · yeni taslak",
      ageBand: "4-7",
    } as Game;

    const games = mergePublishedGames(
      "4-7",
      content.games ?? [],
      [
        { game_id: duplicate.id, game_version: duplicate.version, game: duplicate },
        { game_id: working.id, game_version: working.version, game: working },
      ],
      new Set(),
    );

    expect(games.some((game) => game.id === duplicate.id)).toBe(false);
    expect(games.some((game) => game.id === working.id)).toBe(true);
  });
});
