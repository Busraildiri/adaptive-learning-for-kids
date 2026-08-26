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

  it("treats no response as a valid flow instead of an error", () => {
    const result = send(
      createActivityEngine({ responseTimeoutMs: 7_500 }),
      { type: "NARRATION_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
    );

    expect(result.state).toBe("PLAYING_FEEDBACK");
    expect(result.selectedEmotionId).toBeNull();
    expect(result.config.responseTimeoutMs).toBe(7_500);
  });

  it("ignores emotion taps during the replay window", () => {
    const waitingForReplay = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "EMOTION_SELECTED", emotionId: "sad" },
      { type: "FEEDBACK_ENDED" },
    );

    const result = transition(waitingForReplay, {
      type: "EMOTION_SELECTED",
      emotionId: "happy",
    });

    expect(result).toBe(waitingForReplay);
    expect(result.selectedEmotionId).toBe("sad");
  });

  it("moves on when the three-second replay window expires", () => {
    const result = send(
      createActivityEngine({ replayWindowMs: 3_000 }),
      { type: "NARRATION_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
      { type: "FEEDBACK_ENDED" },
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
      { type: "REPLAY_TAPPED" },
      { type: "REPLAY_ENDED" },
      { type: "REPLAY_TAPPED" },
      { type: "REPLAY_ENDED" },
    );

    expect(result.state).toBe("TRANSITIONING");
    expect(result.replayCount).toBe(2);
  });

  it("starts the next activity with a fresh snapshot", () => {
    const transitioning = send(
      createActivityEngine(),
      { type: "NARRATION_ENDED" },
      { type: "RESPONSE_TIMED_OUT" },
      { type: "FEEDBACK_ENDED" },
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
