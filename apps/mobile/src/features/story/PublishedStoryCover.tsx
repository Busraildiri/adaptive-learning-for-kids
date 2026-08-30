import { createVideoPlayer, type VideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export function PublishedStoryCover({
  mediaRef,
  resolvePublishedMediaRef,
}: {
  mediaRef: string;
  resolvePublishedMediaRef: (mediaRef: string) => Promise<string>;
}) {
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let ownedPlayer: VideoPlayer | null = null;
    setFirstFrameReady(false);
    setPlayer(null);

    void resolvePublishedMediaRef(mediaRef)
      .then((uri) => {
        if (cancelled) return;
        ownedPlayer = createVideoPlayer(uri);
        ownedPlayer.loop = false;
        ownedPlayer.muted = true;
        // A moment after the opening avoids encoder lead-in frames while
        // staying visually representative of the first story scene.
        ownedPlayer.currentTime = 0.12;
        setPlayer(ownedPlayer);
        ownedPlayer.play();
      })
      .catch(() => {
        // The card keeps its generic fallback symbol when a cover cannot be
        // resolved. Story playback will surface a real media error later.
      });

    return () => {
      cancelled = true;
      if (!ownedPlayer) return;
      try {
        ownedPlayer.release();
      } catch {
        // Best-effort cleanup for a card that left the visible page.
      }
    };
  }, [mediaRef, resolvePublishedMediaRef]);

  if (!player) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <VideoView
        allowsFullscreen={false}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => {
          try {
            player.pause();
          } catch {
            // The card may have left the page during the native callback.
          }
          setFirstFrameReady(true);
        }}
        player={player}
        style={[styles.video, firstFrameReady ? styles.visible : styles.preparing]}
        surfaceType="textureView"
        useExoShutter={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  video: { ...StyleSheet.absoluteFillObject },
  visible: { opacity: 1 },
  // Keep the surface alive while decoding, but leave the fallback artwork
  // visually dominant until a real frame has rendered.
  preparing: { opacity: 0.01 },
});
