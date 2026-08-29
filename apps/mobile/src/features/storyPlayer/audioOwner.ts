/**
 * Single-owner audio playback for ChoiceStage: question audio and option
 * audio must never overlap. Starting a new clip always releases whatever
 * was playing first. Imperative (not a hook) so it can be driven from
 * event handlers and released deterministically on unmount/stage change.
 *
 * Built against expo-audio's createAudioPlayer/playbackStatusUpdate API for
 * the installed Expo SDK 54 generation.
 */
import { type AudioPlayer, type AudioStatus, createAudioPlayer } from "expo-audio";

export interface AudioOwner {
  play: (uri: string, onFinish?: () => void) => void;
  release: () => void;
}

export function createAudioOwner(): AudioOwner {
  let current: AudioPlayer | null = null;

  function release(): void {
    if (!current) return;
    const player = current;
    current = null;
    try {
      player.pause();
      player.remove();
    } catch {
      // Best-effort cleanup -- the player may already be released.
    }
  }

  function play(uri: string, onFinish?: () => void): void {
    release();
    const player = createAudioPlayer({ uri });
    current = player;
    player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (!status.didJustFinish || current !== player) return;

      // Dispose the finished choice/question player BEFORE advancing to the
      // next stage. Keeping it alive until ChoiceStage unmounts races the
      // native audio-session teardown against the ending video's play(),
      // which can leave the final video visible but silent on iOS.
      release();
      onFinish?.();
    });
    player.play();
  }

  return { play, release };
}
