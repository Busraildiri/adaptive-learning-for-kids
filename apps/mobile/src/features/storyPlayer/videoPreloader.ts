/**
 * Starts buffering the next clip's video BEFORE it is needed, so the actual
 * transition only has to swap which player is on screen instead of also
 * paying for the video file's own network download + decode time. Signed-URL
 * resolution alone (see mediaResolver.ts) does not touch this cost -- a
 * freshly created expo-video player still has to fetch and buffer the file
 * itself before it can render a frame, which is the dominant chunk of the
 * black-gap time between clips.
 *
 * Players created here are NOT tied to a component's lifecycle (unlike
 * useVideoPlayer), so ownership must be tracked explicitly: `take()` hands a
 * preloaded player to whichever VideoStage instance ends up playing it, and
 * `releaseAllExcept()` disposes any preloaded-but-never-played players (the
 * branch not chosen at a decision) so they don't leak.
 */
import { createVideoPlayer, type VideoPlayer } from "expo-video";

export interface VideoPreloader {
  preload: (clipId: string, uri: string) => Promise<void>;
  take: (clipId: string) => VideoPlayer | null;
  releaseAllExcept: (clipIds: Iterable<string>) => void;
}

interface PreloadedVideo {
  player: VideoPlayer;
  ready: Promise<void>;
  cancelReadinessWait: () => void;
}

const VIDEO_READY_TIMEOUT_MS = 20_000;
const FIRST_FRAME_PREROLL_SECONDS = 0.06;
const FIRST_FRAME_PREROLL_TIMEOUT_MS = 900;

function waitUntilReady(player: VideoPlayer): {
  ready: Promise<void>;
  cancel: () => void;
} {
  let settled = false;
  let rejectReady: ((reason?: unknown) => void) | null = null;
  let subscription: { remove: () => void } | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const currentStatus = () => player.status;

  const cleanup = () => {
    subscription?.remove();
    subscription = null;
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };

  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    if (currentStatus() === "readyToPlay") {
      finish();
      return;
    }
    if (currentStatus() === "error") {
      finish(new Error("Video ön yüklenemedi."));
      return;
    }

    subscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "readyToPlay") finish();
      if (status === "error") {
        finish(new Error(error?.message ?? "Video ön yüklenemedi."));
      }
    });
    timeout = setTimeout(
      () => finish(new Error("Video ön yükleme zaman aşımına uğradı.")),
      VIDEO_READY_TIMEOUT_MS,
    );
    // Close the tiny check/listener race: the native player may become
    // ready after the first status read but before the listener is attached.
    if (currentStatus() === "readyToPlay") finish();
    if (currentStatus() === "error") finish(new Error("Video ön yüklenemedi."));
  });

  return {
    ready,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectReady?.(new Error("Video ön yükleme iptal edildi."));
    },
  };
}

/**
 * readyToPlay means the native player can start, but it does not guarantee
 * that a decoded frame is waiting for a newly mounted VideoView. Briefly
 * advance the muted player and pause it on an early frame so the transition
 * can reveal picture immediately instead of exposing the native black
 * surface while its decoder starts.
 */
function primeFirstFrame(player: VideoPlayer): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let subscription: { remove: () => void } | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      subscription?.remove();
      subscription = null;
      if (timeout) clearTimeout(timeout);
      timeout = null;
      try {
        player.pause();
      } catch {
        // A cancelled/released preload needs no further preparation.
      }
      resolve();
    };

    try {
      player.muted = true;
      player.timeUpdateEventInterval = 0.02;
      subscription = player.addListener("timeUpdate", ({ currentTime }) => {
        if (currentTime >= FIRST_FRAME_PREROLL_SECONDS) finish();
      });
      timeout = setTimeout(finish, FIRST_FRAME_PREROLL_TIMEOUT_MS);
      player.play();
    } catch {
      finish();
    }
  });
}

export function createVideoPreloader(): VideoPreloader {
  const videos = new Map<string, PreloadedVideo>();

  function preload(clipId: string, uri: string): Promise<void> {
    const existing = videos.get(clipId);
    if (existing) return existing.ready;
    const player = createVideoPlayer(uri);
    player.loop = false;
    const readiness = waitUntilReady(player);
    const prepared = readiness.ready.then(() => primeFirstFrame(player));
    const video: PreloadedVideo = {
      player,
      ready: prepared,
      cancelReadinessWait: readiness.cancel,
    };
    videos.set(clipId, video);

    void video.ready.catch(() => {
      if (videos.get(clipId) !== video) return;
      videos.delete(clipId);
      try {
        player.release();
      } catch {
        // The native player may already have released itself after an error.
      }
    });
    return video.ready;
  }

  function take(clipId: string): VideoPlayer | null {
    const video = videos.get(clipId);
    if (!video || video.player.status !== "readyToPlay") return null;
    videos.delete(clipId);
    video.cancelReadinessWait();
    video.player.muted = false;
    return video.player;
  }

  function releaseAllExcept(clipIds: Iterable<string>): void {
    const keep = new Set(clipIds);
    for (const [clipId, video] of videos) {
      if (keep.has(clipId)) continue;
      videos.delete(clipId);
      video.cancelReadinessWait();
      try {
        video.player.release();
      } catch {
        // Best-effort cleanup -- the player was never mounted anywhere.
      }
    }
  }

  return { preload, take, releaseAllExcept };
}
