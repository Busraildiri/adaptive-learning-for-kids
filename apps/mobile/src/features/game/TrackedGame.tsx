import type { Game } from "@adaptive/content-schema";
import type { ChildSessionProfile } from "@adaptive/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createActivityEventRecorder } from "../../services/interactionEvents";
import {
  type AdaptiveProgressionState,
  adaptGameComplexity,
  applyDifficultyLevel,
  continuesAfterMaximumLevel,
  createInitialAdaptiveState,
  findGameVariant,
  maxAdaptiveLevelForGame,
  nextDifficultyAfterCompletion,
  previousProgression,
  previousZuzuProgression,
  requiredRunsForGame,
  shouldAnnounceGameIntro,
} from "./adaptiveGameProgression";
import { BalloonCountingGame } from "./BalloonCountingGame";
import { ClassifyAndSortGame } from "./ClassifyAndSortGame";
import { EmotionCluesGame } from "./EmotionCluesGame";
import { FishPatternsGame } from "./FishPatternsGame";
import { type GameObservation, GameObservationProvider } from "./GameObservationContext";
import { MiniChallengeGame } from "./MiniChallengeGame";
import { MomoWorkshopGame } from "./MomoWorkshopGame";
import { SequenceAndPlaceGame } from "./SequenceAndPlaceGame";
import { TapOrWaitGame } from "./TapOrWaitGame";

export function TrackedGame({
  child,
  game,
  games,
  initialProgress,
  onExit,
  onProgress,
}: {
  child: ChildSessionProfile;
  game: Game;
  games: Game[];
  initialProgress?: {
    adaptiveLevel: number;
    challengeIndex: number;
    completedRunsAtLevel: number;
  };
  onExit: () => void;
  onProgress?: (progress: AdaptiveProgressionState, completed?: boolean) => void;
}) {
  const initialState = createInitialAdaptiveState(game, initialProgress);
  const maximumLevel = maxAdaptiveLevelForGame(game);
  const initialGame = applyDifficultyLevel(
    findGameVariant(games, game, initialState.difficulty) ?? game,
    initialState.difficulty,
  );
  const [activeGame, setActiveGame] = useState(() =>
    adaptGameComplexity(initialGame, initialState.itemCount, initialState.challengeIndex),
  );
  const [runKey, setRunKey] = useState(0);
  const [progression, setProgression] = useState<AdaptiveProgressionState>(initialState);
  const currentRunCompleted = useRef(false);
  const progressedStepCount = useRef(0);
  const exiting = useRef(false);
  const recorder = useMemo(
    () =>
      createActivityEventRecorder({
        childId: child.id,
        activityId: activeGame.id,
        enabled: child.learningObservationsEnabled,
      }),
    [activeGame.id, child.id, child.learningObservationsEnabled, runKey],
  );

  useEffect(() => {
    void recorder.record("activity_started", {
      activityKind: "game",
      mechanic: activeGame.mechanic,
      ageBand: activeGame.ageBand,
      difficulty: activeGame.difficulty.level,
      adaptiveLevel: progression.adaptiveLevel,
      gameVersion: activeGame.version,
    });
  }, [activeGame, progression.adaptiveLevel, recorder, runKey]);

  const startRun = useCallback(
    (nextGame: Game, nextProgression: AdaptiveProgressionState) => {
      currentRunCompleted.current = false;
      setProgression(nextProgression);
      setActiveGame(nextGame);
      setRunKey((current) => current + 1);
      onProgress?.(nextProgression);
    },
    [onProgress],
  );

  const report = useCallback(
    (observation: GameObservation) => {
      if (observation.type === "attempt") {
        if (observation.correct) progressedStepCount.current += 1;
        void recorder.record("choice_selected", {
          stepId: observation.stepId,
          bktCorrect: observation.correct,
        });
      } else if (observation.type === "completed") {
        if (currentRunCompleted.current) return;
        currentRunCompleted.current = true;
        void recorder.record("activity_completed", { stepId: observation.stepId });

        const nextProgression = nextDifficultyAfterCompletion(
          progression,
          child.ageBand,
          maximumLevel,
          requiredRunsForGame(activeGame, child.ageBand),
        );
        const reachedFinalLevel =
          progression.adaptiveLevel === maximumLevel && nextProgression.completedRunsAtLevel === 0;
        if (reachedFinalLevel && !continuesAfterMaximumLevel(activeGame)) {
          setProgression(nextProgression);
          onProgress?.(nextProgression, true);
          return;
        }
        const nextVariant = applyDifficultyLevel(
          findGameVariant(games, activeGame, nextProgression.difficulty) ?? activeGame,
          nextProgression.difficulty,
        );
        startRun(
          adaptGameComplexity(
            nextVariant,
            nextProgression.itemCount,
            nextProgression.challengeIndex,
          ),
          nextProgression,
        );
      } else if (observation.type === "retry") {
        void recorder.record("retry_requested", { stepId: observation.stepId });
        const easierProgression =
          activeGame.id === "zuzu-missing-piece-001"
            ? previousZuzuProgression(progression)
            : previousProgression(progression);
        const easierGame = applyDifficultyLevel(
          findGameVariant(games, activeGame, easierProgression.difficulty) ?? activeGame,
          easierProgression.difficulty,
        );
        startRun(
          adaptGameComplexity(
            easierGame,
            easierProgression.itemCount,
            easierProgression.challengeIndex,
          ),
          easierProgression,
        );
        if (activeGame.id === "zuzu-missing-piece-001") {
          onProgress?.(easierProgression, false);
        }
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
    [activeGame, child.ageBand, games, maximumLevel, onProgress, progression, recorder, startRun],
  );

  const restart = useCallback(() => {
    const starter = applyDifficultyLevel(
      findGameVariant(games, activeGame, "starter") ?? activeGame,
      "starter",
    );
    const challengeIndex =
      activeGame.id === "nino-sound-rhythm-001" ? 0 : progression.challengeIndex + 1;
    startRun(adaptGameComplexity(starter, 2, challengeIndex), {
      difficulty: starter.difficulty.level,
      completedRunsAtLevel: 0,
      itemCount: 2,
      challengeIndex,
      adaptiveLevel: 1,
    });
  }, [activeGame, games, progression.challengeIndex, startRun]);

  const exit = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;

    void (async () => {
      try {
        if (!currentRunCompleted.current) {
          await recorder.record("activity_abandoned", {
            activityKind: "game",
            progressedStepCount: progressedStepCount.current,
            maxItemCount: progression.itemCount,
            adaptiveLevel: progression.adaptiveLevel,
          });
        }
        await recorder.ensurePersisted();
      } catch {
        // Navigation must stay available even if local persistence fails unexpectedly.
      } finally {
        onExit();
      }
      void recorder.flush().catch(() => undefined);
    })().catch(() => undefined);
  }, [onExit, progression.itemCount, recorder]);

  const screen =
    activeGame.mechanic === "classify_and_sort" ? (
      <ClassifyAndSortGame
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : activeGame.mechanic === "sequence_and_place" ? (
      <SequenceAndPlaceGame
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : activeGame.mechanic === "emotion_clues" ? (
      <EmotionCluesGame
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : activeGame.mechanic === "fish_patterns" ? (
      <FishPatternsGame
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : activeGame.mechanic === "balloon_counting" ? (
      <BalloonCountingGame
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : activeGame.mechanic === "mini_challenge" ? (
      <MiniChallengeGame
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : activeGame.mechanic === "momo_workshop" ? (
      <MomoWorkshopGame
        adaptiveLevel={progression.adaptiveLevel}
        childId={child.id}
        childName={child.nickname}
        chapterIndex={progression.challengeIndex}
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : (
      <TapOrWaitGame
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    );

  return <GameObservationProvider report={report}>{screen}</GameObservationProvider>;
}
