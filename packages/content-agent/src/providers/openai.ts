import type { StructuredModel } from "../index";

const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";

interface OpenAIResponseContent {
  type?: string;
  text?: string;
}

interface OpenAIResponseOutput {
  type?: string;
  content?: OpenAIResponseContent[];
}

interface OpenAIResponse {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  status?: string;
}

interface OpenAIErrorResponse {
  error?: {
    message?: string;
    code?: string | null;
    param?: string | null;
  };
}

function safeProviderMessage(value: unknown, apiKey: string): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as OpenAIErrorResponse;
  const message = response.error?.message;
  if (!message) return null;
  return message
    .replaceAll(apiKey, "[redacted-openai-key]")
    .replace(/sk-[A-Za-z0-9_-]+/gu, "[redacted-openai-key]")
    .slice(0, 500);
}

function normalizeResponseSchema(value: unknown): {
  schema: Record<string, unknown>;
  strict: boolean;
} {
  let convertedUnion = false;
  const visit = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== "object") return current;
    const source = current as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      if (key === "$schema") continue;
      if (key === "oneOf") {
        convertedUnion = true;
        normalized.anyOf = visit(child);
      } else {
        normalized[key] = visit(child);
      }
    }
    return normalized;
  };
  return {
    schema: visit(value) as Record<string, unknown>,
    strict: !convertedUnion,
  };
}

export interface OpenAIStructuredModelOptions {
  apiKey: string;
  model: string;
  endpoint?: string;
  fetchImplementation?: typeof fetch;
}

export class OpenAIProviderError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "OpenAIProviderError";
    this.status = status;
  }
}

function extractOutputText(response: OpenAIResponse): string | null {
  if (response.output_text) return response.output_text;
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export function createOpenAIStructuredModel(
  options: OpenAIStructuredModelOptions,
): StructuredModel {
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  if (!apiKey) throw new Error("OpenAI API key is required.");
  if (!model) throw new Error("OpenAI model is required.");
  const request = options.fetchImplementation ?? fetch;

  return {
    model,
    async generateJson(input) {
      const responseSchema = normalizeResponseSchema(input.jsonSchema);
      const response = await request(options.endpoint ?? DEFAULT_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions: input.system,
          input: input.prompt,
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: input.schemaName,
              description: input.schemaDescription,
              schema: responseSchema.schema,
              strict: responseSchema.strict,
            },
          },
        }),
      });

      if (!response.ok) {
        let providerMessage: string | null = null;
        try {
          providerMessage = safeProviderMessage(await response.json(), apiKey);
        } catch {
          providerMessage = null;
        }
        throw new OpenAIProviderError(
          `OpenAI request failed with HTTP ${response.status}${
            providerMessage ? `: ${providerMessage}` : "."
          }`,
          response.status,
        );
      }
      const result = (await response.json()) as OpenAIResponse;
      const outputText = extractOutputText(result);
      if (!outputText) {
        throw new OpenAIProviderError("OpenAI response did not contain structured output.");
      }
      try {
        return JSON.parse(outputText) as unknown;
      } catch {
        throw new OpenAIProviderError("OpenAI structured output was not valid JSON.");
      }
    },
  };
}
