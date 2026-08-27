import type { StructuredModel } from "../index";

const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

interface GeminiInteractionResponse {
  output_text?: string;
  status?: string;
}

export interface GeminiStructuredModelOptions {
  apiKey: string;
  model: string;
  dataUsageTier: "paid";
  endpoint?: string;
  fetchImplementation?: typeof fetch;
}

export class GeminiProviderError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "GeminiProviderError";
    this.status = status;
  }
}

export function createGeminiStructuredModel(
  options: GeminiStructuredModelOptions,
): StructuredModel {
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  if (!apiKey) throw new Error("Gemini API key is required.");
  if (!model) throw new Error("Gemini model is required.");
  if (options.dataUsageTier !== "paid") {
    throw new Error("Gemini content generation requires a verified paid API project.");
  }
  const request = options.fetchImplementation ?? fetch;

  return {
    model,
    async generateJson(input) {
      const response = await request(options.endpoint ?? DEFAULT_GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model,
          input: input.prompt,
          system_instruction: input.system,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: input.jsonSchema,
          },
          generation_config: {
            temperature: 0.8,
            thinking_level: "low",
          },
          store: false,
        }),
      });

      if (!response.ok) {
        throw new GeminiProviderError(
          `Gemini request failed with HTTP ${response.status}.`,
          response.status,
        );
      }
      const interaction = (await response.json()) as GeminiInteractionResponse;
      if (!interaction.output_text) {
        throw new GeminiProviderError("Gemini response did not contain structured output.");
      }
      try {
        return JSON.parse(interaction.output_text) as unknown;
      } catch {
        throw new GeminiProviderError("Gemini structured output was not valid JSON.");
      }
    },
  };
}
