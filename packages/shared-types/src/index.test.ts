import { describe, expect, it } from "vitest";
import { calculateAgeInMonths, createChildSessionProfile, resolveAgeBand } from "./index";

const august2026 = new Date(2026, 7, 15);

describe("child age bands", () => {
  it("calculates age using birth month without requiring a full birth date", () => {
    expect(calculateAgeInMonths(8, 2024, august2026)).toBe(24);
    expect(calculateAgeInMonths(9, 2024, august2026)).toBe(23);
  });

  it("maps 24-47 months to the 2-4 experience", () => {
    expect(resolveAgeBand(8, 2024, august2026)).toBe("2-4");
    expect(resolveAgeBand(9, 2022, august2026)).toBe("2-4");
  });

  it("maps 48-83 months to the 4-7 experience", () => {
    expect(resolveAgeBand(8, 2022, august2026)).toBe("4-7");
    expect(resolveAgeBand(9, 2019, august2026)).toBe("4-7");
  });

  it("returns null outside the supported age range", () => {
    expect(resolveAgeBand(9, 2024, august2026)).toBeNull();
    expect(resolveAgeBand(8, 2019, august2026)).toBeNull();
  });

  it("creates an immutable session projection from the stored profile", () => {
    expect(
      createChildSessionProfile(
        {
          id: "child-1",
          parentId: "parent-1",
          nickname: "Ece",
          birthMonth: 8,
          birthYear: 2023,
          contentLocale: "tr-TR",
          favoriteAnimals: ["tavşan"],
          favoriteToys: ["balon"],
          interests: ["renkler"],
        },
        august2026,
      ),
    ).toEqual({
      id: "child-1",
      nickname: "Ece",
      ageBand: "2-4",
      contentLocale: "tr-TR",
      favoriteAnimals: ["tavşan"],
      favoriteToys: ["balon"],
      interests: ["renkler"],
    });
  });

  it("rejects invalid birth months", () => {
    expect(() => calculateAgeInMonths(13, 2023, august2026)).toThrow(RangeError);
  });
});
