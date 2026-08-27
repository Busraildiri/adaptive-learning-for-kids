import { describe, expect, it } from "vitest";
import { createOpenAIContentModelsFromEnv } from "./openaiRuntime";

describe("OpenAI content model configuration", () => {
  it("creates separate generator and supervisor clients", () => {
    const models = createOpenAIContentModelsFromEnv({
      OPENAI_API_KEY: "secret-test-key",
      OPENAI_PRODUCER_MODEL: "producer-model",
      OPENAI_REVIEWER_MODEL: "reviewer-model",
    });

    expect(models.generator).not.toBe(models.supervisor);
    expect(models.generator.model).toBe("producer-model");
    expect(models.supervisor.model).toBe("reviewer-model");
  });

  it("uses the cost-controlled prototype model by default", () => {
    const models = createOpenAIContentModelsFromEnv({ OPENAI_API_KEY: "secret-test-key" });
    expect(models.generator.model).toBe("gpt-5.4-mini");
    expect(models.supervisor.model).toBe("gpt-5.4-mini");
  });

  it("fails closed without a server-side key", () => {
    expect(() => createOpenAIContentModelsFromEnv({})).toThrow("OPENAI_API_KEY is required");
  });
});
