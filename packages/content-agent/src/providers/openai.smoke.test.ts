import { describe, expect, it } from "vitest";
import { createOpenAIStructuredModel } from "./openai";

const enabled = process.env.RUN_OPENAI_SMOKE === "1";

describe.skipIf(!enabled)("OpenAI live smoke", () => {
  it("returns schema-valid JSON without persisting the response", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const modelName = process.env.OPENAI_PRODUCER_MODEL ?? "gpt-5.4-mini";
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live smoke test.");
    const model = createOpenAIStructuredModel({ apiKey, model: modelName });

    const result = await model.generateJson({
      system: "Return only the requested structured JSON.",
      prompt: "Return a successful health check.",
      schemaName: "health_check",
      schemaDescription: "Minimal provider connectivity check.",
      jsonSchema: {
        type: "object",
        properties: { ok: { type: "boolean", const: true } },
        required: ["ok"],
        additionalProperties: false,
      },
    });

    expect(result).toEqual({ ok: true });
  });
});
