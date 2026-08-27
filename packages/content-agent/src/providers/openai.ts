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
              schema: input.jsonSchema,
              strict: true,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new OpenAIProviderError(
          `OpenAI request failed with HTTP ${response.status}.`,
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
