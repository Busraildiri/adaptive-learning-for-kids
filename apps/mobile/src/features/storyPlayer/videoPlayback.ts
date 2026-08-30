// Never declare a clip complete *before* its media duration. The previous
// 100 ms tolerance unmounted the ending player while the last syllable was
// still audible on some iPhones. playToEnd remains the primary signal; this
// helper is only the exact-duration fallback for native event edge cases.
const PLAYBACK_END_EPSILON_SECONDS = 0.005;
// Native players can stop on the timestamp of the final decoded frame rather
// than on the container duration. This wider tolerance is safe only after the
// player has already reported that it is no longer playing; it must never be
// used to unmount a player whose final audio is still audible.
const STOPPED_AT_FINAL_FRAME_TOLERANCE_SECONDS = 0.25;

function playbackDurationSeconds(
  nativeDurationSeconds: number,
  publishedDurationMs: number,
): number {
  return Number.isFinite(nativeDurationSeconds) && nativeDurationSeconds > 0
    ? nativeDurationSeconds
    : publishedDurationMs / 1000;
}

export function hasReachedPlaybackEnd(
  currentTimeSeconds: number,
  nativeDurationSeconds: number,
  publishedDurationMs: number,
): boolean {
  const durationSeconds = playbackDurationSeconds(nativeDurationSeconds, publishedDurationMs);
  return (
    Number.isFinite(currentTimeSeconds) &&
    durationSeconds > 0 &&
    currentTimeSeconds + PLAYBACK_END_EPSILON_SECONDS >= durationSeconds
  );
}

export function hasStoppedAtFinalFrame(
  currentTimeSeconds: number,
  nativeDurationSeconds: number,
  publishedDurationMs: number,
): boolean {
  const durationSeconds = playbackDurationSeconds(nativeDurationSeconds, publishedDurationMs);
  return (
    Number.isFinite(currentTimeSeconds) &&
    durationSeconds > 0 &&
    currentTimeSeconds + STOPPED_AT_FINAL_FRAME_TOLERANCE_SECONDS >= durationSeconds
  );
}
