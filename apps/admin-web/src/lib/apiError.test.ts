import { describe, expect, it } from "vitest";
import { describeUnknownError } from "./apiError";

describe("API error descriptions", () => {
  it("keeps Supabase error fields instead of replacing them with a generic message", () => {
    expect(
      describeUnknownError(
        {
          code: "42501",
          message: "permission denied",
          details: "create_media_job RPC failed",
          hint: "Check the content-admin grant",
        },
        "fallback",
      ),
    ).toEqual({
      code: "42501",
      message: "permission denied",
      details: "create_media_job RPC failed",
      hint: "Check the content-admin grant",
    });
  });

  it("supports ordinary errors and a safe fallback", () => {
    expect(describeUnknownError(new Error("Model response timed out"), "fallback").message).toBe(
      "Model response timed out",
    );
    expect(describeUnknownError(null, "fallback")).toEqual({ message: "fallback" });
  });
});
