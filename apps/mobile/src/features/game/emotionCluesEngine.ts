import type { EmotionClueRound } from "@adaptive/content-schema";

export function isEmotionChoiceCorrect(
  round: EmotionClueRound,
  choice: EmotionClueRound["correctEmotion"],
) {
  return round.correctEmotion === choice;
}

export function isClueChoiceCorrect(
  round: EmotionClueRound,
  choice: EmotionClueRound["correctClue"],
) {
  return round.correctClue === choice;
}
