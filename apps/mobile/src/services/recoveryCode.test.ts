import { describe, expect, it } from "vitest";
import { isValidRecoveryCode, normalizeRecoveryCode } from "./recoveryCode";

describe("parola yenileme kodu", () => {
  it("boşlukları ve rakam olmayan karakterleri kaldırır", () => {
    expect(normalizeRecoveryCode("12 3a-4567")).toBe("123456");
  });

  it("yalnızca tam altı haneli kodu kabul eder", () => {
    expect(isValidRecoveryCode("123456")).toBe(true);
    expect(isValidRecoveryCode("12345")).toBe(false);
    expect(isValidRecoveryCode("1234567")).toBe(false);
    expect(isValidRecoveryCode("12345a")).toBe(false);
  });
});
