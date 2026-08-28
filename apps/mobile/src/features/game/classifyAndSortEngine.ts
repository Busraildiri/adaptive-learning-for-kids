import type { SortObject, SortRound } from "@adaptive/content-schema";

export type SortAttemptOutcome = "matched" | "retry";

export function objectMatchesRound(object: SortObject, round: SortRound): boolean {
  return object[round.dimension] === round.targetValue;
}

export function outcomeForSortAttempt(object: SortObject, round: SortRound): SortAttemptOutcome {
  return objectMatchesRound(object, round) ? "matched" : "retry";
}
