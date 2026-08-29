const PLAYBACK_END_TOLERANCE_SECONDS = 0.1;

export function hasReachedPlaybackEnd(
  currentTimeSeconds: number,
  nativeDurationSeconds: number,
  publishedDurationMs: number,
): boolean {
  const durationSeconds =
    Number.isFinite(nativeDurationSeconds) && nativeDurationSeconds > 0
      ? nativeDurationSeconds
      : publishedDurationMs / 1000;
  return (
    Number.isFinite(currentTimeSeconds) &&
    durationSeconds > 0 &&
    currentTimeSeconds >= Math.max(0, durationSeconds - PLAYBACK_END_TOLERANCE_SECONDS)
  );
}
