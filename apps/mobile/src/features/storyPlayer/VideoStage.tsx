import type { PublishedPlaybackClip } from "@adaptive/media-schema";
import { useEventListener } from "expo";
import { createVideoPlayer, type VideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { hasReachedPlaybackEnd } from "./videoPlayback";
import type { VideoPreloader } from "./videoPreloader";

type VideoClip = Extract<PublishedPlaybackClip, { kind: "linear" | "ending" }>;

interface VideoLayerState {
  clipId: string;
  player: VideoPlayer;
}

function VideoLayer({
  active,
  clipId,
  durationMs,
  onComplete,
  onError,
  onFirstFrame,
  player,
}: {
  active: boolean;
  clipId: string;
  durationMs: number;
  onComplete: (clipId: string) => void;
  onError: (clipId: string, detail: string) => void;
  onFirstFrame: (clipId: string) => void;
  player: VideoPlayer;
}) {
  const completedRef = useRef(false);
  const disposedRef = useRef(false);

  function completeOnce() {
    if (completedRef.current || disposedRef.current) return;
    completedRef.current = true;
    onComplete(clipId);
  }

  function playerReachedEnd(currentTime?: number): boolean {
    try {
      return hasReachedPlaybackEnd(currentTime ?? player.currentTime, player.duration, durationMs);
    } catch {
      // A final native event can arrive after release(). It must not turn a
      // completed/unmounted layer into a new playback failure.
      return false;
    }
  }

  useEffect(() => {
    disposedRef.current = false;
    player.timeUpdateEventInterval = 0.1;
    player.play();
    return () => {
      disposedRef.current = true;
      try {
        player.release();
      } catch {
        // A native player can already be released after a playback error.
      }
    };
  }, [player]);

  useEventListener(player, "playToEnd", completeOnce);
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (playerReachedEnd(currentTime)) completeOnce();
  });
  useEventListener(player, "playingChange", ({ isPlaying }) => {
    if (!isPlaying && playerReachedEnd()) completeOnce();
  });
  useEventListener(player, "statusChange", ({ status, error }) => {
    if (status === "error") {
      // Some native players report an error while being torn down just
      // after the final frame. That is a completed clip, not a story error.
      if (disposedRef.current) return;
      if (playerReachedEnd()) {
        completeOnce();
        return;
      }
      onError(clipId, error?.message ?? "Video could not be played");
    }
  });

  return (
    <VideoView
      allowsFullscreen={false}
      contentFit="contain"
      nativeControls={false}
      onFirstFrameRender={() => onFirstFrame(clipId)}
      player={player}
      style={[styles.video, active ? styles.visibleVideo : styles.hiddenVideo]}
      surfaceType="textureView"
      useExoShutter={false}
    />
  );
}

export function VideoStage({
  clip,
  onComplete,
  onError,
  resolvePublishedMediaRef,
  preloader,
}: {
  clip: VideoClip;
  onComplete: () => void;
  onError: (detail: string) => void;
  resolvePublishedMediaRef: (mediaRef: string) => Promise<string>;
  preloader: VideoPreloader;
}) {
  const [layers, setLayers] = useState<VideoLayerState[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const targetClipIdRef = useRef(clip.id);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  targetClipIdRef.current = clip.id;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    let ownedPlayer: VideoPlayer | null = null;

    async function addNextLayer() {
      try {
        ownedPlayer = preloader.take(clip.id);
        if (!ownedPlayer) {
          const uri = await resolvePublishedMediaRef(clip.video.mediaRef);
          if (cancelled) return;
          // The first clip has no previous stage from which it can be
          // preloaded. Create it directly here; later transitions normally
          // arrive through preloader.take() after StoryPlayer's readiness
          // gate has completed.
          ownedPlayer = createVideoPlayer(uri);
          ownedPlayer.loop = false;
        }
        if (!ownedPlayer) {
          throw new Error(`Prepared video player is unavailable for clip "${clip.id}"`);
        }
        if (cancelled) return;

        const nextPlayer = ownedPlayer;
        ownedPlayer = null;
        setLayers((current) => {
          if (current.some((layer) => layer.clipId === clip.id)) {
            try {
              nextPlayer.release();
            } catch {
              // The duplicate player is no longer needed.
            }
            return current;
          }
          // Keep the previous layer mounted on its final frame. The new
          // layer starts invisibly above it and only replaces it after the
          // native VideoView confirms that its first frame was rendered.
          return [...current, { clipId: clip.id, player: nextPlayer }];
        });
      } catch (error) {
        if (!cancelled) {
          onErrorRef.current(
            error instanceof Error
              ? error.message
              : `Failed to prepare media for clip "${clip.id}"`,
          );
        }
      }
    }

    void addNextLayer();
    return () => {
      cancelled = true;
      if (ownedPlayer) {
        try {
          ownedPlayer.release();
        } catch {
          // Best-effort cleanup for a player acquired during an aborted transition.
        }
      }
    };
  }, [clip.id, clip.video.mediaRef, preloader, resolvePublishedMediaRef]);

  function handleFirstFrame(clipId: string) {
    if (clipId !== targetClipIdRef.current) return;
    setActiveClipId(clipId);
    setLayers((current) => current.filter((layer) => layer.clipId === clipId));
  }

  function handleComplete(clipId: string) {
    if (clipId === targetClipIdRef.current) onCompleteRef.current();
  }

  function handleError(clipId: string, detail: string) {
    if (clipId === targetClipIdRef.current) onErrorRef.current(detail);
  }

  return (
    <View style={styles.container}>
      {layers.map((layer) => (
        <VideoLayer
          active={layer.clipId === activeClipId}
          clipId={layer.clipId}
          durationMs={clip.video.durationMs}
          key={layer.clipId}
          onComplete={handleComplete}
          onError={handleError}
          onFirstFrame={handleFirstFrame}
          player={layer.player}
        />
      ))}
      {activeClipId ? null : <ActivityIndicator color="#397F78" size="large" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF6E8",
  },
  video: { ...StyleSheet.absoluteFillObject },
  visibleVideo: { opacity: 1, zIndex: 2 },
  // Keep a tiny non-zero opacity so native compositors do not optimize the
  // warm-up surface away before onFirstFrameRender fires. The previous
  // opaque layer remains above it while the next frame is prepared.
  hiddenVideo: { opacity: 0.01, zIndex: 1 },
});
