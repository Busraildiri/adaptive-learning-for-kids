import type { Game } from "@adaptive/content-schema";
import type { ChildSessionProfile } from "@adaptive/shared-types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { createActivityEventRecorder } from "../../services/interactionEvents";
import { BalloonCountingGame } from "./BalloonCountingGame";
import { ClassifyAndSortGame } from "./ClassifyAndSortGame";
import { EmotionCluesGame } from "./EmotionCluesGame";
import { FishPatternsGame } from "./FishPatternsGame";
import { type GameObservation, GameObservationProvider } from "./GameObservationContext";
import { MiniChallengeGame } from "./MiniChallengeGame";
import { SequenceAndPlaceGame } from "./SequenceAndPlaceGame";
import { TapOrWaitGame } from "./TapOrWaitGame";

export function TrackedGame({
  child,
  game,
  onExit,
}: {
  child: ChildSessionProfile;
  game: Game;
  onExit: () => void;
}) {
  const completed = useRef(false);
  const exiting = useRef(false);
  const recorder = useMemo(
    () =>
      createActivityEventRecorder({
        childId: child.id,
        activityId: game.id,
        enabled: child.learningObservationsEnabled,
      }),
    [child.id, child.learningObservationsEnabled, game.id],
  );

  useEffect(() => {
    void recorder.record("activity_started", {
      activityKind: "game",
      mechanic: game.mechanic,
      ageBand: game.ageBand,
      difficulty: game.difficulty.level,
      gameVersion: game.version,
    });
  }, [game, recorder]);

  const report = useCallback(
    (observation: GameObservation) => {
      if (observation.type === "attempt") {
        void recorder.record("choice_selected", {
          stepId: observation.stepId,
          bktCorrect: observation.correct,
        });
      } else if (observation.type === "completed") {
        if (completed.current) return;
        completed.current = true;
        void recorder.record("activity_completed", { stepId: observation.stepId });
      } else if (observation.type === "retry") {
        void recorder.record("retry_requested", { stepId: observation.stepId });
      } else if (observation.type === "wait") {
        void recorder.record("inactivity_help_shown", {
          stepId: observation.stepId,
          waitMs: observation.waitMs,
        });
      } else {
        void recorder.record("hint_requested", {
          stepId: observation.stepId,
          action: "game_support",
        });
      }
    },
    [recorder],
  );

  const exit = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;

    void (async () => {
      try {
        if (!completed.current) {
          await recorder.record("activity_abandoned", { activityKind: "game" });
        }
        await recorder.ensurePersisted();
      } catch {
        // Navigation must stay available even if local persistence fails unexpectedly.
      } finally {
        onExit();
      }
      void recorder.flush().catch(() => undefined);
    })().catch(() => undefined);
  }, [onExit, recorder]);

  const screen =
    game.mechanic === "classify_and_sort" ? (
      <ClassifyAndSortGame game={game} onExit={exit} />
    ) : game.mechanic === "sequence_and_place" ? (
      <SequenceAndPlaceGame game={game} onExit={exit} />
    ) : game.mechanic === "emotion_clues" ? (
      <EmotionCluesGame game={game} onExit={exit} />
    ) : game.mechanic === "fish_patterns" ? (
      <FishPatternsGame game={game} onExit={exit} />
    ) : game.mechanic === "balloon_counting" ? (
      <BalloonCountingGame game={game} onExit={exit} />
    ) : game.mechanic === "mini_challenge" ? (
      <MiniChallengeGame game={game} onExit={exit} />
    ) : (
      <TapOrWaitGame game={game} onExit={exit} />
    );

  return <GameObservationProvider report={report}>{screen}</GameObservationProvider>;
}
