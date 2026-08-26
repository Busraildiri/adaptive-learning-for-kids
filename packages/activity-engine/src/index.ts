export type ActivityState =
  | "PLAYING_NARRATION"
  | "WAITING_FOR_EMOTION"
  | "PLAYING_FEEDBACK"
  | "PLAYING_REPLAY_PROMPT"
  | "WAITING_FOR_REPLAY_TAP"
  | "REPLAYING"
  | "TRANSITIONING"
  | "COMPLETED";

export interface ActivityEngineConfig {
  responseTimeoutMs: number;
  replayWindowMs: number;
  maxReplayCount: number;
}

export interface ActivityEngineSnapshot {
  state: ActivityState;
  replayCount: number;
  selectedEmotionId: string | null;
  config: ActivityEngineConfig;
}

export type ActivityEngineEvent =
  | { type: "NARRATION_ENDED" }
  | { type: "EMOTION_SELECTED"; emotionId: string }
  | { type: "RESPONSE_TIMED_OUT" }
  | { type: "FEEDBACK_ENDED" }
  | { type: "REPLAY_PROMPT_ENDED" }
  | { type: "REPLAY_TAPPED" }
  | { type: "REPLAY_WINDOW_EXPIRED" }
  | { type: "REPLAY_ENDED" }
  | { type: "TRANSITION_ENDED"; hasNextActivity: boolean };

export const DEFAULT_ACTIVITY_ENGINE_CONFIG: ActivityEngineConfig = {
  responseTimeoutMs: 10_000,
  replayWindowMs: 3_000,
  maxReplayCount: 2,
};

export function createActivityEngine(
  config: Partial<ActivityEngineConfig> = {},
): ActivityEngineSnapshot {
  const resolvedConfig = { ...DEFAULT_ACTIVITY_ENGINE_CONFIG, ...config };

  if (resolvedConfig.responseTimeoutMs <= 0 || resolvedConfig.replayWindowMs <= 0) {
    throw new RangeError("Activity timeouts must be greater than zero.");
  }

  if (!Number.isInteger(resolvedConfig.maxReplayCount) || resolvedConfig.maxReplayCount < 0) {
    throw new RangeError("maxReplayCount must be a non-negative integer.");
  }

  return {
    state: "PLAYING_NARRATION",
    replayCount: 0,
    selectedEmotionId: null,
    config: resolvedConfig,
  };
}

export function transition(
  snapshot: ActivityEngineSnapshot,
  event: ActivityEngineEvent,
): ActivityEngineSnapshot {
  switch (snapshot.state) {
    case "PLAYING_NARRATION":
      return event.type === "NARRATION_ENDED"
        ? { ...snapshot, state: "WAITING_FOR_EMOTION" }
        : snapshot;

    case "WAITING_FOR_EMOTION":
      if (event.type === "EMOTION_SELECTED") {
        return { ...snapshot, state: "PLAYING_FEEDBACK", selectedEmotionId: event.emotionId };
      }
      return event.type === "RESPONSE_TIMED_OUT"
        ? {
            ...snapshot,
            state:
              snapshot.replayCount >= snapshot.config.maxReplayCount
                ? "TRANSITIONING"
                : "PLAYING_REPLAY_PROMPT",
            selectedEmotionId: null,
          }
        : snapshot;

    case "PLAYING_FEEDBACK":
      return event.type === "FEEDBACK_ENDED"
        ? {
            ...snapshot,
            state:
              snapshot.replayCount >= snapshot.config.maxReplayCount
                ? "TRANSITIONING"
                : "PLAYING_REPLAY_PROMPT",
          }
        : snapshot;

    case "PLAYING_REPLAY_PROMPT":
      return event.type === "REPLAY_PROMPT_ENDED"
        ? { ...snapshot, state: "WAITING_FOR_REPLAY_TAP" }
        : snapshot;

    case "WAITING_FOR_REPLAY_TAP":
      if (event.type === "REPLAY_TAPPED" && snapshot.replayCount < snapshot.config.maxReplayCount) {
        return {
          ...snapshot,
          state: "REPLAYING",
          replayCount: snapshot.replayCount + 1,
          selectedEmotionId: null,
        };
      }
      return event.type === "REPLAY_WINDOW_EXPIRED"
        ? { ...snapshot, state: "TRANSITIONING" }
        : snapshot;

    case "REPLAYING":
      return event.type === "REPLAY_ENDED"
        ? { ...snapshot, state: "WAITING_FOR_EMOTION" }
        : snapshot;

    case "TRANSITIONING":
      if (event.type !== "TRANSITION_ENDED") return snapshot;
      return event.hasNextActivity
        ? createActivityEngine(snapshot.config)
        : { ...snapshot, state: "COMPLETED" };

    case "COMPLETED":
      return snapshot;
  }
}
