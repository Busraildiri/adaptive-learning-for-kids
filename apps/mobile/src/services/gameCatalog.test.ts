import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";

describe("game catalog fixture", () => {
  it("contains a published fallback game for ages 2-4", () => {
    const content = contentVersionSchema.parse(contentV1);
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
});
