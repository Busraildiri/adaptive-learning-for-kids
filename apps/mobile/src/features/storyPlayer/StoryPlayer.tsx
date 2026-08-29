/**
 * Child-facing playback for a published video_branching experience. Data
 * delivery is a separate concern: this component receives an already
 * validated PublishedStoryExperience and never queries Supabase for it --
 * only mediaRef -> signed URL resolution happens here.
 */
import {
  type PublishedStoryExperience,
  validatePublishedExperienceGraph,
} from "@adaptive/media-schema";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text } from "react-native";
import { supabase } from "../../lib/supabase";
import { ChoiceStage } from "./ChoiceStage";
import { FinishedStage } from "./FinishedStage";
import { createPublishedMediaResolver } from "./mediaResolver";
import { StoryPlayerErrorScreen } from "./StoryPlayerErrorScreen";
import { buildClipLookup, initialStage, type StoryPlayerStage } from "./storyPlayerGraph";
import { reduceStoryPlayerRuntime, type StoryPlayerEvent } from "./storyPlayerRuntime";
import { VideoStage } from "./VideoStage";
import { createVideoPreloader } from "./videoPreloader";

export function StoryPlayer({
  experience,
  onExit,
}: {
  experience: PublishedStoryExperience;
  onExit: () => void;
}) {
  const clips = useMemo(() => buildClipLookup(experience), [experience]);
  const graphIssues = useMemo(() => validatePublishedExperienceGraph(experience), [experience]);
  const resolver = useMemo(() => (supabase ? createPublishedMediaResolver(supabase) : null), []);
  const preloader = useMemo(() => createVideoPreloader(), []);

  const [stage, setStage] = useState<StoryPlayerStage>(() => initialStage(experience));
  const [fatalError, setFatalError] = useState<string | null>(null);
  // A ref, not state: `dispatch` reads it synchronously so a duplicate event
  // fired before React commits the previous transition (e.g. two rapid
  // playToEnd emissions, or two taps) is rejected even from a stale closure
  // -- state alone can't guarantee that, since a component that hasn't
  // re-rendered yet still holds a callback closing over the OLD state.
  const advancingRef = useRef(false);
  const transitionSequenceRef = useRef(0);

  useEffect(() => {
    if (graphIssues.length > 0) {
      console.error("[StoryPlayer] published experience failed graph validation", graphIssues);
    }
    if (!resolver) {
      console.error("[StoryPlayer] Supabase is not configured; cannot resolve published media.");
    }
  }, [graphIssues, resolver]);

  useEffect(() => {
    advancingRef.current = false;
  }, [stage]);

  // Start buffering whatever clip(s) might play next while the current one
  // is still on screen. Resolving the signed URL alone (mediaResolver's
  // cache) turned out NOT to remove the black-screen gap -- the dominant
  // cost is the video player itself fetching and decoding the file, which
  // only starts once a player is created. So this both resolves the URL and
  // hands it to the preloader, which creates a real (not-yet-playing) player
  // now so it has a head start buffering before the transition happens.
  useEffect(() => {
    if (!resolver) return;
    let cancelled = false;
    const clip = clips.get(stage.stage === "finished" ? "" : stage.clipId);
    if (!clip) return;
    // A linear transition has one certain next video, so warming one native
    // player is both useful and safe. A decision has two possible ending
    // videos: creating both audio-bearing native players at once can race
    // iOS audio/player teardown when the unselected branch is released.
    // Keep the choice screen mounted and prepare only the branch actually
    // selected in dispatch() below.
    const upcomingClipIds = clip.kind === "linear" ? [clip.nextClipId] : [];
    // Drop any previously preloaded player for a branch that wasn't taken
    // (e.g. the choice not picked at a decision), so it doesn't leak.
    preloader.releaseAllExcept(upcomingClipIds);
    for (const nextId of upcomingClipIds) {
      const nextClip = clips.get(nextId);
      if (nextClip && nextClip.kind !== "decision") {
        void resolver
          .resolvePublishedMediaRef(nextClip.video.mediaRef)
          .then((uri) => {
            if (cancelled) return;
            return preloader.preload(nextId, uri);
          })
          .catch(() => {
            // Best-effort prefetch -- a real failure surfaces again, loudly,
            // when the transition actually happens and resolves for real.
          });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [stage, clips, resolver, preloader]);

  useEffect(() => {
    return () => {
      transitionSequenceRef.current += 1;
      preloader.releaseAllExcept([]);
    };
  }, [preloader]);

  function dispatch(event: StoryPlayerEvent): void {
    if (event.type !== "REPLAY" && advancingRef.current) return;
    const result = reduceStoryPlayerRuntime(
      clips,
      experience,
      { stage, advancing: advancingRef.current },
      event,
    );
    if (!result.ok) {
      console.error(`[StoryPlayer] ${result.error}`);
      setFatalError(result.error);
      return;
    }
    advancingRef.current = result.state.advancing;
    const nextStage = result.state.stage;
    const transitionSequence = ++transitionSequenceRef.current;

    if (nextStage.stage === "video" && resolver) {
      const nextClip = clips.get(nextStage.clipId);
      if (!nextClip || nextClip.kind === "decision") {
        setFatalError(`Video clip "${nextStage.clipId}" is unavailable.`);
        return;
      }

      // Do not remove the current screen at playToEnd/choice time. Wait
      // until the next native player has actually reached readyToPlay; for a
      // video-to-video transition this deliberately leaves the old video's
      // final frame mounted instead of exposing the black player surface.
      void resolver
        .resolvePublishedMediaRef(nextClip.video.mediaRef)
        .then((uri) => preloader.preload(nextClip.id, uri))
        .then(() => {
          if (transitionSequenceRef.current === transitionSequence) setStage(nextStage);
        })
        .catch((error: unknown) => {
          if (transitionSequenceRef.current !== transitionSequence) return;
          setFatalError(
            error instanceof Error
              ? error.message
              : `Failed to prepare media for clip "${nextClip.id}"`,
          );
        });
      return;
    }

    setStage(nextStage);
  }

  function retry(): void {
    transitionSequenceRef.current += 1;
    setFatalError(null);
    advancingRef.current = false;
    setStage(initialStage(experience));
  }

  if (graphIssues.length > 0 || !resolver) {
    return <StoryPlayerErrorScreen onExit={onExit} onRetry={retry} />;
  }

  if (fatalError) {
    return <StoryPlayerErrorScreen onExit={onExit} onRetry={retry} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden />
      {(stage.stage === "video" || stage.stage === "choice") && (
        <Pressable
          accessibilityLabel="Hikâyeden çık"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onExit}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonSymbol}>✕</Text>
        </Pressable>
      )}
      {stage.stage === "video" &&
        (() => {
          const clip = clips.get(stage.clipId);
          if (!clip || clip.kind === "decision") {
            return <StoryPlayerErrorScreen onExit={onExit} onRetry={retry} />;
          }
          return (
            <VideoStage
              clip={clip}
              onComplete={() => dispatch({ type: "VIDEO_COMPLETE", clipId: stage.clipId })}
              onError={(detail) => {
                console.error(`[StoryPlayer] ${detail}`);
                setFatalError(detail);
              }}
              preloader={preloader}
              resolvePublishedMediaRef={resolver.resolvePublishedMediaRef}
            />
          );
        })()}
      {stage.stage === "choice" &&
        (() => {
          const clip = clips.get(stage.clipId);
          if (!clip || clip.kind !== "decision") {
            return <StoryPlayerErrorScreen onExit={onExit} onRetry={retry} />;
          }
          return (
            <ChoiceStage
              clip={clip}
              key={stage.clipId}
              onError={(detail) => {
                console.error(`[StoryPlayer] ${detail}`);
                setFatalError(detail);
              }}
              onSelect={(optionId) =>
                dispatch({ type: "CHOICE_SELECT", clipId: stage.clipId, optionId })
              }
              resolvePublishedMediaRef={resolver.resolvePublishedMediaRef}
            />
          );
        })()}
      {stage.stage === "finished" && (
        <FinishedStage onExit={onExit} onReplay={() => dispatch({ type: "REPLAY" })} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF6E8" },
  closeButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  closeButtonSymbol: { color: "#FF6B6B", fontSize: 20, fontWeight: "900" },
});
