import type { MiniChallengeGame } from "@adaptive/content-schema";

type MiniChallengeRound = MiniChallengeGame["rounds"][number];

export function expectedChoiceId(
  round: MiniChallengeRound,
  enteredCount: number,
): string | undefined {
  const expectedIndex = round.kind === "single" ? 0 : enteredCount;
  return round.correctSequence[expectedIndex];
}

export function choicesAfterCorrectAnswer(
  round: MiniChallengeRound,
  entered: string[],
  choiceId: string,
): string[] {
  return round.kind === "single" ? [choiceId] : [...entered, choiceId];
}
