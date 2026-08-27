import { describe, expect, it } from "vitest";
import { createGeminiStructuredModel } from "./gemini";

const enabled = process.env.RUN_GEMINI_SMOKE === "1";

describe.skipIf(!enabled)("Gemini live smoke test", () => {
  it("returns schema-constrained JSON without logging content", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_PRODUCER_MODEL;
    const dataUsageTier = process.env.GEMINI_API_TIER;
    if (!apiKey || !modelName || dataUsageTier !== "paid") {
      throw new Error("Gemini smoke test requires a verified paid API project.");
    }
    const model = createGeminiStructuredModel({ apiKey, model: modelName, dataUsageTier });
    const result = await model.generateJson({
      system: "Yalnızca verilen JSON şemasına uyan çıktı üret.",
      prompt: "Kişisel veri kullanmadan bağlantı kontrolü yap ve ok değerini true döndür.",
      schemaName: "geminiSmokeCheck",
      schemaDescription: "A private connection check.",
      jsonSchema: {
        type: "object",
        properties: { ok: { type: "boolean", const: true } },
        required: ["ok"],
        additionalProperties: false,
      },
    });
    expect(result).toEqual({ ok: true });
  }, 30_000);
});
