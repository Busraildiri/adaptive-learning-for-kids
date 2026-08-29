import { contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import {
  createSessionOrder,
  getContentPage,
  getContentPageCount,
  groupOlderGames,
} from "./olderGameCategories";

const games = (contentVersionSchema.parse(contentJson).games ?? []).filter(
  (game) => game.ageBand === "4-7" && game.status === "published",
);

describe("4-7 game worlds", () => {
  it("places Momo in the workshop and Bobi in the pattern sea", () => {
    const groups = groupOlderGames(games);

    expect(groups.get("workshop")?.map((game) => game.id)).toContain("momo-wake-up-001");
    expect(groups.get("pattern_sea")?.map((game) => game.id)).toContain("bobi-fish-memory-4-7-001");
  });

  it("does not create empty worlds", () => {
    const groups = groupOlderGames(games);

    expect([...groups.values()].every((worldGames) => worldGames.length > 0)).toBe(true);
  });
});

describe("2-4 game worlds", () => {
  const youngerGames = (contentVersionSchema.parse(contentJson).games ?? []).filter(
    (game) => game.ageBand === "2-4" && game.status === "published",
  );

  it("groups every published game into a picture-led world", () => {
    const groups = groupOlderGames(youngerGames);
    const groupedIds = [...groups.values()].flatMap((worldGames) =>
      worldGames.map((game) => game.id),
    );

    expect(groupedIds).toHaveLength(youngerGames.length);
    expect(groups.get("movement")?.map((game) => game.id)).toContain("color-lights-001");
    expect(groups.get("feelings")?.map((game) => game.id)).toContain("mino-emotion-detective-001");
    expect(groups.get("workshop")?.map((game) => game.id)).toContain("pofi-balloon-counting-001");
    expect(groups.get("pattern_sea")?.map((game) => game.id)).toContain(
      "bobi-fish-patterns-2-4-001",
    );
  });
});

describe("discovery session ordering", () => {
  const items = ["one", "two", "three", "four", "five", "six"];

  it("keeps a session stable and puts the recommendation first", () => {
    const first = createSessionOrder(items, (item) => item, "five", "session-a");
    const second = createSessionOrder(items, (item) => item, "five", "session-a");

    expect(first).toEqual(second);
    expect(first[0]).toBe("five");
  });

  it("shows at most four items and wraps after the final page", () => {
    expect(getContentPageCount(items.length)).toBe(2);
    expect(getContentPage(items, 0)).toEqual(["one", "two", "three", "four"]);
    expect(getContentPage(items, 1)).toEqual(["five", "six"]);
    expect(getContentPage(items, 2)).toEqual(["one", "two", "three", "four"]);
  });
});
