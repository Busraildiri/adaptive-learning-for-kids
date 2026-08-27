import { describe, expect, it, vi } from "vitest";
import { createOpenAIStructuredModel, OpenAIProviderError } from "./openai";

const request = {
  system: "Only JSON.",
  prompt: "Return a health check.",
  schemaName: "health_check",
  schemaDescription: "A boolean health check.",
  jsonSchema: {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
    additionalProperties: false,
  },
};

describe("OpenAI structured model", () => {
  it("uses Responses structured outputs with storage disabled", async () => {
    const fetchImplementation = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model: "gpt-test",
        instructions: request.system,
        input: request.prompt,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: request.schemaName,
            description: request.schemaDescription,
            schema: request.jsonSchema,
            strict: true,
          },
        },
      });
      expect(String(init?.body)).not.toContain("secret-test-key");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret-test-key");
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: '{"ok":true}' }],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const model = createOpenAIStructuredModel({
      apiKey: "secret-test-key",
      model: "gpt-test",
      fetchImplementation,
    });

    await expect(model.generateJson(request)).resolves.toEqual({ ok: true });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("accepts the SDK-compatible output_text field", async () => {
    const model = createOpenAIStructuredModel({
      apiKey: "secret-test-key",
      model: "gpt-test",
      fetchImplementation: async () =>
        new Response(JSON.stringify({ output_text: '{"ok":true}' }), { status: 200 }),
    });

    await expect(model.generateJson(request)).resolves.toEqual({ ok: true });
  });

  it("returns sanitized provider errors without response bodies or credentials", async () => {
    const model = createOpenAIStructuredModel({
      apiKey: "secret-test-key",
      model: "gpt-test",
      fetchImplementation: async () =>
        new Response('{"error":{"message":"provider detail"}}', { status: 429 }),
    });

    const error = await model.generateJson(request).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(OpenAIProviderError);
    expect(error).toMatchObject({ status: 429, message: "OpenAI request failed with HTTP 429." });
    expect(String(error)).not.toContain("provider detail");
    expect(String(error)).not.toContain("secret-test-key");
  });
});
