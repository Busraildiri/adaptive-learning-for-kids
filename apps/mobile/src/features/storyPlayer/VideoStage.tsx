import type { PublishedPlaybackClip } from "@adaptive/media-schema";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type VideoClip = Extract<PublishedPlaybackClip, { kind: "linear" | "ending" }>;

function PlayingVideo({
  uri,
  onComplete,
  onError,
}: {
  uri: string;
  onComplete: () => void;
  onError: (detail: string) => void;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.play();
  });

  useEventListener(player, "playToEnd", onComplete);
  useEventListener(player, "statusChange", ({ status, error }) => {
    if (status === "error") onError(error?.message ?? `Video could not be played: ${uri}`);
  });

  return (
    <VideoView
      allowsFullscreen={false}
      contentFit="contain"
      nativeControls={false}
      player={player}
      style={styles.video}
    />
  );
}

export function VideoStage({
  clip,
  onComplete,
  onError,
  resolvePublishedMediaRef,
}: {
  clip: VideoClip;
  onComplete: () => void;
  onError: (detail: string) => void;
  resolvePublishedMediaRef: (mediaRef: string) => Promise<string>;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    resolvePublishedMediaRef(clip.video.mediaRef)
      .then((resolved) => {
        if (!cancelled) setUri(resolved);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onErrorRef.current(
            error instanceof Error ? error.message : `Failed to resolve media for clip "${clip.id}"`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by clip.id at the call site
  }, [clip.id]);

  return (
    <View style={styles.container}>
      {uri ? (
        <PlayingVideo onComplete={onComplete} onError={onError} uri={uri} />
      ) : (
        <ActivityIndicator color="#FFFFFF" size="large" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" },
  video: { width: "100%", height: "100%" },
});
