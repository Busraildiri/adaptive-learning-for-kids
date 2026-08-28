import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import {
  feedbackForOutcome,
  outcomeForTap,
  outcomeForTimeout,
  ruleForRound,
} from "./tapOrWaitEngine";

const game = contentVersionSchema
  .parse(contentV1)
  .games?.find((candidate) => candidate.mechanic === "tap_or_wait");
if (!game || game.mechanic !== "tap_or_wait") throw new Error("Expected a tap-or-wait fixture.");

describe("tap-or-wait engine", () => {
  it("resolves configured rules for each round", () => {
    expect(ruleForRound(game, 0).id).toBe("green-tap");
    expect(ruleForRound(game, 1).id).toBe("red-wait");
  });

  it("matches tap counts without treating partial taps as a result", () => {
    const rule = ruleForRound(game, 0);
    expect(outcomeForTap(rule, 0)).toBeNull();
    expect(outcomeForTap(rule, 1)).toBe("matched_expected_action");
  });

  it("distinguishes waiting, early taps and missing responses", () => {
    expect(outcomeForTimeout(ruleForRound(game, 1))).toBe("matched_expected_action");
    expect(outcomeForTap(ruleForRound(game, 1), 1)).toBe("tap_during_wait");
    expect(outcomeForTimeout(ruleForRound(game, 0))).toBe("no_response");
  });

  it("returns non-judgmental configured feedback", () => {
    expect(feedbackForOutcome(game, "tap_during_wait")).toBe(game.feedback.tapWhileWaiting);
    expect(feedbackForOutcome(game, "no_response")).toBe(game.feedback.noResponse);
  });
});
