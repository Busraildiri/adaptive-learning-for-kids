import { describe, expect, it, vi } from "vitest";
import { createGeminiStructuredModel, GeminiProviderError } from "./gemini";

const request = {
  system: "Only JSON.",
  prompt: "Return a health check.",
  schemaName: "healthCheck",
  schemaDescription: "A boolean health check.",
  jsonSchema: {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
    additionalProperties: false,
  },
};

describe("Gemini structured model", () => {
  it("uses native JSON schema without exposing the API key in the request body", async () => {
    const fetchImplementation = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.response_format).toEqual({
        type: "text",
        mime_type: "application/json",
        schema: request.jsonSchema,
      });
      expect(body.store).toBe(false);
      expect(String(init?.body)).not.toContain("secret-test-key");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("secret-test-key");
      return new Response(JSON.stringify({ output_text: '{"ok":true}', status: "completed" }), {
        status: 200,
      });
    });
    const model = createGeminiStructuredModel({
      apiKey: "secret-test-key",
      model: "gemini-test",
      dataUsageTier: "paid",
      fetchImplementation,
    });

    await expect(model.generateJson(request)).resolves.toEqual({ ok: true });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("returns sanitized provider errors without response bodies or credentials", async () => {
    const model = createGeminiStructuredModel({
      apiKey: "secret-test-key",
      model: "gemini-test",
      dataUsageTier: "paid",
      fetchImplementation: async () =>
        new Response('{"error":{"message":"provider detail"}}', { status: 429 }),
    });

    const error = await model.generateJson(request).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(GeminiProviderError);
    expect(error).toMatchObject({ status: 429, message: "Gemini request failed with HTTP 429." });
    expect(String(error)).not.toContain("provider detail");
    expect(String(error)).not.toContain("secret-test-key");
  });

  it("refuses to initialize without an explicit paid data-usage tier", () => {
    expect(() =>
      createGeminiStructuredModel({
        apiKey: "secret-test-key",
        model: "gemini-test",
        dataUsageTier: "free" as "paid",
      }),
    ).toThrow("verified paid API project");
  });
});
