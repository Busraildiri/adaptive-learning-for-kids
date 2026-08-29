/**
 * Single-owner audio playback for ChoiceStage: question audio and option
 * audio must never overlap. Starting a new clip always releases whatever
 * was playing first. Imperative (not a hook) so it can be driven from
 * event handlers and released deterministically on unmount/stage change.
 *
 * Built against expo-audio's documented createAudioPlayer/
 * playbackStatusUpdate API for the installed Expo SDK 54 generation. Not
 * yet verified against installed source (expo-audio is declared in
 * package.json but pnpm install has not run in this environment) -- worth
 * a quick sanity check against node_modules/expo-audio's types once
 * installed, before relying on this in a device test.
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
      if (status.didJustFinish && current === player) onFinish?.();
    });
    player.play();
  }

  return { play, release };
}
