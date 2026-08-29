/**
 * Child-facing playback for a published video_branching experience. Data
 * delivery is a separate concern: this component receives an already
 * validated PublishedStoryExperience and never queries Supabase for it --
 * only mediaRef -> signed URL resolution happens here.
 */
import { validatePublishedExperienceGraph, type PublishedStoryExperience } from "@adaptive/media-schema";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { supabase } from "../../lib/supabase";
import { ChoiceStage } from "./ChoiceStage";
import { FinishedStage } from "./FinishedStage";
import { createPublishedMediaResolver } from "./mediaResolver";
import { StoryPlayerErrorScreen } from "./StoryPlayerErrorScreen";
import { buildClipLookup, initialStage, type StoryPlayerStage } from "./storyPlayerGraph";
import { reduceStoryPlayerRuntime, type StoryPlayerEvent } from "./storyPlayerRuntime";
import { VideoStage } from "./VideoStage";

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

  const [stage, setStage] = useState<StoryPlayerStage>(() => initialStage(experience));
  const [fatalError, setFatalError] = useState<string | null>(null);
  // A ref, not state: `dispatch` reads it synchronously so a duplicate event
  // fired before React commits the previous transition (e.g. two rapid
  // playToEnd emissions, or two taps) is rejected even from a stale closure
  // -- state alone can't guarantee that, since a component that hasn't
  // re-rendered yet still holds a callback closing over the OLD state.
  const advancingRef = useRef(false);

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
    setStage(result.state.stage);
  }

  function retry(): void {
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
      {stage.stage === "video" &&
        (() => {
          const clip = clips.get(stage.clipId);
          if (!clip || clip.kind === "decision") {
            return <StoryPlayerErrorScreen onExit={onExit} onRetry={retry} />;
          }
          return (
            <VideoStage
              clip={clip}
              key={stage.clipId}
              onComplete={() => dispatch({ type: "VIDEO_COMPLETE", clipId: stage.clipId })}
              onError={(detail) => {
                console.error(`[StoryPlayer] ${detail}`);
                setFatalError(detail);
              }}
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
  safeArea: { flex: 1, backgroundColor: "#000000" },
});
