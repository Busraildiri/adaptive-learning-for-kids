import type { MomoCableEndpoint, MomoShape } from "@adaptive/content-schema";

export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };
export type CableDropTarget = {
  id: string;
  bounds: Bounds;
  connected?: boolean;
};

export type GuidedAttemptOutcome = "matched" | "retry" | "reveal";

export function cableEndpointsMatch(first: MomoCableEndpoint, second: MomoCableEndpoint): boolean {
  return first.id !== second.id && first.side !== second.side && first.matchKey === second.matchKey;
}

export function dropPointHitsBounds(point: Point, bounds: Bounds, tolerance = 18): boolean {
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
}

export function findCableDropTarget(
  point: Point,
  sourceId: string,
  candidates: CableDropTarget[],
  tolerance = 18,
): string | null {
  const matchingCandidates = candidates.filter(
    (candidate) =>
      candidate.id !== sourceId &&
      !candidate.connected &&
      dropPointHitsBounds(point, candidate.bounds, tolerance),
  );
  matchingCandidates.sort((left, right) => {
    const leftX = left.bounds.x + left.bounds.width / 2;
    const leftY = left.bounds.y + left.bounds.height / 2;
    const rightX = right.bounds.x + right.bounds.width / 2;
    const rightY = right.bounds.y + right.bounds.height / 2;
    return (
      (point.x - leftX) ** 2 +
      (point.y - leftY) ** 2 -
      ((point.x - rightX) ** 2 + (point.y - rightY) ** 2)
    );
  });
  return matchingCandidates[0]?.id ?? null;
}

export function crystalCountMatches(selectedCount: number, targetCount: number): boolean {
  return selectedCount === targetCount;
}

export function patternShapeMatches(selected: MomoShape, correct: MomoShape): boolean {
  return selected === correct;
}

export function outcomeForGuidedAttempt(
  correct: boolean,
  previousWrongAttempts: number,
  secondTryEnabled: boolean,
): GuidedAttemptOutcome {
  if (correct) return "matched";
  return secondTryEnabled && previousWrongAttempts === 0 ? "retry" : "reveal";
}
