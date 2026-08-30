import { describe, expect, it } from "vitest";
import { formatChildAge } from "./childAge";

describe("formatChildAge", () => {
  it("formats age using elapsed years and months", () => {
    expect(formatChildAge(5, 2021, new Date(2026, 7, 30))).toBe("5 yıl 3 ay");
  });

  it("updates when a new birth month boundary is crossed", () => {
    expect(formatChildAge(9, 2022, new Date(2026, 7, 31))).toBe("3 yıl 11 ay");
    expect(formatChildAge(9, 2022, new Date(2026, 8, 1))).toBe("4 yıl 0 ay");
  });
});
