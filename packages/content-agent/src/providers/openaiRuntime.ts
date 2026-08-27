import type { StructuredModel } from "../index";
import { createOpenAIStructuredModel } from "./openai";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

export interface OpenAIContentModels {
  generator: StructuredModel;
  supervisor: StructuredModel;
}

export function createOpenAIContentModelsFromEnv(
  environment: Record<string, string | undefined> = process.env,
): OpenAIContentModels {
  const apiKey = environment.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for the content agent.");

  return {
    generator: createOpenAIStructuredModel({
      apiKey,
      model: environment.OPENAI_PRODUCER_MODEL ?? DEFAULT_OPENAI_MODEL,
    }),
    supervisor: createOpenAIStructuredModel({
      apiKey,
      model: environment.OPENAI_REVIEWER_MODEL ?? DEFAULT_OPENAI_MODEL,
    }),
  };
}
