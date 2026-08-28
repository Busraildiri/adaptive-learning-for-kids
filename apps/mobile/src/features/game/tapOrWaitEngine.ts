import type { GameRule, TapOrWaitGame } from "@adaptive/content-schema";

export type TapOrWaitRoundOutcome = "matched_expected_action" | "tap_during_wait" | "no_response";

export function ruleForRound(game: TapOrWaitGame, roundIndex: number): GameRule {
  const round = game.roundPlan.rounds[roundIndex];
  if (!round) throw new Error(`Missing round at index ${roundIndex}.`);
  const rule = game.rules.find((candidate) => candidate.id === round.ruleId);
  if (!rule) throw new Error(`Missing rule ${round.ruleId}.`);
  return rule;
}

export function outcomeForTimeout(rule: GameRule): TapOrWaitRoundOutcome {
  return rule.expectedAction.type === "wait_without_tap"
    ? "matched_expected_action"
    : "no_response";
}

export function outcomeForTap(rule: GameRule, tapCount: number): TapOrWaitRoundOutcome | null {
  if (rule.expectedAction.type === "wait_without_tap") return "tap_during_wait";
  return tapCount >= rule.expectedAction.count ? "matched_expected_action" : null;
}

export function feedbackForOutcome(game: TapOrWaitGame, outcome: TapOrWaitRoundOutcome): string {
  if (outcome === "matched_expected_action") return game.feedback.expectedActionMatched;
  if (outcome === "tap_during_wait") return game.feedback.tapWhileWaiting;
  return game.feedback.noResponse;
}
