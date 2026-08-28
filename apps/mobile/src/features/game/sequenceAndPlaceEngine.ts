import type { RoutineRound } from "@adaptive/content-schema";

export function isRoutineOrderCorrect(round: RoutineRound, placedIds: string[]): boolean {
  return (
    placedIds.length === round.correctOrder.length &&
    placedIds.every((itemId, index) => itemId === round.correctOrder[index])
  );
}

export function shuffledRoutineItems<T>(items: T[], roundIndex: number): T[] {
  return roundIndex % 2 === 0 ? [...items].reverse() : [...items];
}
