import { describe, expect, it } from "vitest";
import { createActivityEngine, transition } from "./index";

const send = (
  snapshot: ReturnType<typeof createActivityEngine>,
  ...events: Parameters<typeof transition>[1][]
) => events.reduce(transition, snapshot);

describe("activity engine", () => {
  it("follows the emotion selection flow", () => {
    const result = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "happy" },
    );

    expect(result.state).toBe("PLAYING_FEEDBACK");
    expect(result.selectedEmotionId).toBe("happy");
  });

  it("skips evaluative feedback when there is no response", () => {
    const result = send(
      createActivityEngine({ responseTimeoutMs: 7_500 }),
      { type: "NARRATION_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
    );

    expect(result.state).toBe("PLAYING_REPLAY_PROMPT");
    expect(result.selectedEmotionId).toBeNull();
    expect(result.config.responseTimeoutMs).toBe(7_500);
  });

  it("plays the replay prompt before opening the three-second tap window", () => {
    const result = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "sad" },
      { type: "FEEDBACK_ENDED" },
      { type: "REPLAY_PROMPT_ENDED" },
    );

    expect(result.state).toBe("WAITING_FOR_REPLAY_TAP");
  });

  it("ignores emotion taps while replay input is active", () => {
    const playingPrompt = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "sad" },
      { type: "FEEDBACK_ENDED" },
    );
    const waitingForReplay = transition(playingPrompt, { type: "REPLAY_PROMPT_ENDED" });

    expect(transition(playingPrompt, { type: "EMOTION_SELECTED", emotionId: "happy" })).toBe(
      playingPrompt,
    );
    expect(transition(waitingForReplay, { type: "EMOTION_SELECTED", emotionId: "happy" })).toBe(
      waitingForReplay,
    );
    expect(waitingForReplay.selectedEmotionId).toBe("sad");
  });

  it("reopens emotion selection after replaying the narration", () => {
    const result = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "sad" },
      { type: "FEEDBACK_ENDED" },
      { type: "REPLAY_PROMPT_ENDED" },
      { type: "REPLAY_TAPPED" },
      { type: "REPLAY_ENDED" },
    );

    expect(result.state).toBe("WAITING_FOR_EMOTION");
    expect(result.replayCount).toBe(1);
    expect(result.selectedEmotionId).toBeNull();
  });

  it("moves on when the three-second replay window expires", () => {
    const result = send(
      createActivityEngine({ replayWindowMs: 3_000 }),
      { type: "NARRATION_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
      { type: "REPLAY_PROMPT_ENDED" },
      { type: "REPLAY_WINDOW_EXPIRED" },
    );

    expect(result.state).toBe("TRANSITIONING");
    expect(result.config.replayWindowMs).toBe(3_000);
  });

  it("automatically transitions after the second replay", () => {
    const result = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "angry" },
      { type: "FEEDBACK_ENDED" },
      { type: "REPLAY_PROMPT_ENDED" },
      { type: "REPLAY_TAPPED" },
      { type: "REPLAY_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "sad" },
      { type: "FEEDBACK_ENDED" },
      { type: "REPLAY_PROMPT_ENDED" },
      { type: "REPLAY_TAPPED" },
      { type: "REPLAY_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "sad" },
      { type: "FEEDBACK_ENDED" },
    );

    expect(result.state).toBe("TRANSITIONING");
    expect(result.replayCount).toBe(2);
  });

  it("automatically transitions after a timeout on the second replay", () => {
    const result = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
      { type: "REPLAY_PROMPT_ENDED" },
      { type: "REPLAY_TAPPED" },
      { type: "REPLAY_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
      { type: "REPLAY_PROMPT_ENDED" },
      { type: "REPLAY_TAPPED" },
      { type: "REPLAY_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
    );

    expect(result.state).toBe("TRANSITIONING");
    expect(result.replayCount).toBe(2);
  });

  it("does not offer replay when replay is disabled", () => {
    const result = send(
      createActivityEngine({ maxReplayCount: 0 }),
      { type: "NARRATION_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "happy" },
      { type: "FEEDBACK_ENDED" },
    );

    expect(result.state).toBe("TRANSITIONING");
  });

  it("starts the next activity with a fresh snapshot", () => {
    const transitioning = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
      { type: "REPLAY_PROMPT_ENDED" },
      { type: "REPLAY_WINDOW_EXPIRED" },
    );

    expect(transition(transitioning, { type: "TRANSITION_ENDED", hasNextActivity: true })).toEqual(
      createActivityEngine(),
    );
    expect(
      transition(transitioning, { type: "TRANSITION_ENDED", hasNextActivity: false }).state,
    ).toBe("COMPLETED");
  });

  it("rejects invalid timing and replay configuration", () => {
    expect(() => createActivityEngine({ responseTimeoutMs: 0 })).toThrow(RangeError);
    expect(() => createActivityEngine({ replayWindowMs: -1 })).toThrow(RangeError);
    expect(() => createActivityEngine({ maxReplayCount: 1.5 })).toThrow(RangeError);
  });
});
