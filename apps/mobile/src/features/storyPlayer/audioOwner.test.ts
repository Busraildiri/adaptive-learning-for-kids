import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakePlayer {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  emitFinish: () => void;
}

function makeFakePlayer(): FakePlayer {
  let finishListener: (() => void) | null = null;
  return {
    play: vi.fn(),
    pause: vi.fn(),
    remove: vi.fn(),
    addListener: vi.fn((event: string, listener: (status: { didJustFinish: boolean }) => void) => {
      if (event === "playbackStatusUpdate") {
        finishListener = () => listener({ didJustFinish: true });
      }
    }),
    emitFinish: () => finishListener?.(),
  };
}

const createAudioPlayerMock = vi.fn();
vi.mock("expo-audio", () => ({
  createAudioPlayer: (...args: unknown[]) => createAudioPlayerMock(...args),
}));

describe("audioOwner", () => {
  beforeEach(() => createAudioPlayerMock.mockReset());
  afterEach(() => vi.resetModules());

  it("starting a new clip releases whatever was already playing", async () => {
    const { createAudioOwner } = await import("./audioOwner");
    const first = makeFakePlayer();
    const second = makeFakePlayer();
    createAudioPlayerMock.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const owner = createAudioOwner();
    owner.play("question.m4a");
    expect(first.play).toHaveBeenCalledTimes(1);

    owner.play("option-a.m4a");
    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(first.remove).toHaveBeenCalledTimes(1);
    expect(second.play).toHaveBeenCalledTimes(1);
  });

  it("calls onFinish when the currently-owned player reports didJustFinish", async () => {
    const { createAudioOwner } = await import("./audioOwner");
    const player = makeFakePlayer();
    createAudioPlayerMock.mockReturnValueOnce(player);

    const owner = createAudioOwner();
    const onFinish = vi.fn();
    owner.play("clip.m4a", onFinish);
    player.emitFinish();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("a stale player's finish event is ignored once a new one has taken over", async () => {
    const { createAudioOwner } = await import("./audioOwner");
    const first = makeFakePlayer();
    const second = makeFakePlayer();
    createAudioPlayerMock.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const owner = createAudioOwner();
    const onFinishFirst = vi.fn();
    owner.play("first.m4a", onFinishFirst);
    owner.play("second.m4a");
    first.emitFinish();
    expect(onFinishFirst).not.toHaveBeenCalled();
  });

  it("release() stops and releases the current player", async () => {
    const { createAudioOwner } = await import("./audioOwner");
    const player = makeFakePlayer();
    createAudioPlayerMock.mockReturnValueOnce(player);

    const owner = createAudioOwner();
    owner.play("clip.m4a");
    owner.release();
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.remove).toHaveBeenCalledTimes(1);

    // release() again is a safe no-op.
    owner.release();
    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});
