import type { Game } from "@adaptive/content-schema";
import type { ChildSessionProfile } from "@adaptive/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { createActivityEventRecorder } from "../../services/interactionEvents";
import {
  type AdaptiveProgressionState,
  adaptGameComplexity,
  applyDifficultyLevel,
  BOBI_FISH_MEMORY_GAME_ID,
  BOBI_FISH_PATTERN_GAME_ID,
  bobiFishCountForLevel,
  continuesAfterMaximumLevel,
  createInitialAdaptiveState,
  findGameVariant,
  KIKI_SHOP_GAME_ID,
  LILA_LIGHT_GAME_ID,
  lilaRoundCountForLevel,
  MAYA_MORNING_GAME_ID,
  maxAdaptiveLevelForGame,
  nextDifficultyAfterCompletion,
  POFI_BALLOON_GAME_ID,
  pofiBalloonCountForLevel,
  previousProgression,
  previousZuzuProgression,
  requiredRunsForGame,
  shouldAnnounceGameIntro,
  TOKO_MAP_GAME_ID,
} from "./adaptiveGameProgression";
import { BalloonCountingGame } from "./BalloonCountingGame";
import { ClassifyAndSortGame } from "./ClassifyAndSortGame";
import { EmotionCluesGame } from "./EmotionCluesGame";
import { FishPatternsGame } from "./FishPatternsGame";
import { type GameObservation, GameObservationProvider } from "./GameObservationContext";
import { MiniChallengeGame } from "./MiniChallengeGame";
import { MomoWorkshopGame } from "./MomoWorkshopGame";
import { SequenceAndPlaceGame } from "./SequenceAndPlaceGame";

function adaptationIndexForRun(game: Game, progression: AdaptiveProgressionState): number {
  // Pati has a fixed rule curriculum. Its persisted challenge counter can
  // include older retries, so use the visible level to keep the next rule
  // distinct instead of accidentally returning to the same color rule.
  return game.id === "rule-changed-garden-001" ||
    game.id === "mino-routine-path-001" ||
    game.id === "mino-emotion-detective-001" ||
    game.id === POFI_BALLOON_GAME_ID ||
    game.id === BOBI_FISH_PATTERN_GAME_ID ||
    game.id === BOBI_FISH_MEMORY_GAME_ID ||
    game.id === TOKO_MAP_GAME_ID ||
    game.id === LILA_LIGHT_GAME_ID ||
    game.id === MAYA_MORNING_GAME_ID ||
    game.id === KIKI_SHOP_GAME_ID
    ? progression.adaptiveLevel - 1
    : progression.challengeIndex;
}

function progressionForGame(
  game: Game,
  progression: AdaptiveProgressionState,
): AdaptiveProgressionState {
  if (
    game.mechanic === "fish_patterns" &&
    (game.id === BOBI_FISH_PATTERN_GAME_ID || game.id === BOBI_FISH_MEMORY_GAME_ID)
  ) {
    return {
      ...progression,
      itemCount: bobiFishCountForLevel(progression.adaptiveLevel),
    };
  }
  if (game.id === POFI_BALLOON_GAME_ID && game.mechanic === "balloon_counting") {
    return {
      ...progression,
      itemCount: pofiBalloonCountForLevel(progression.adaptiveLevel),
    };
  }
  if (game.id === LILA_LIGHT_GAME_ID && game.mechanic === "tap_or_wait") {
    return {
      ...progression,
      itemCount: lilaRoundCountForLevel(progression.adaptiveLevel),
    };
  }
  if (game.id !== "mino-routine-path-001" || game.mechanic !== "sequence_and_place") {
    return progression;
  }
  return {
    ...progression,
    itemCount: game.rounds[progression.adaptiveLevel - 1]?.items.length ?? progression.itemCount,
  };
}

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
  onProgress?: (progress: AdaptiveProgressionState, completed?: boolean) => void | Promise<void>;
}) {
  const initialState = progressionForGame(game, createInitialAdaptiveState(game, initialProgress));
  const maximumLevel = maxAdaptiveLevelForGame(game);
  const initialGame = applyDifficultyLevel(
    findGameVariant(games, game, initialState.difficulty) ?? game,
    initialState.difficulty,
  );
  const [activeGame, setActiveGame] = useState(() =>
    adaptGameComplexity(
      initialGame,
      initialState.itemCount,
      adaptationIndexForRun(game, initialState),
    ),
  );
  const [runKey, setRunKey] = useState(0);
  const [progression, setProgression] = useState<AdaptiveProgressionState>(initialState);
  const currentRunCompleted = useRef(false);
  const spokenInstructions = useRef(new Set<string>());
  const progressedStepCount = useRef(0);
  const exiting = useRef(false);
  const onProgressRef = useRef(onProgress);
  const pendingProgressWrite = useRef<Promise<void>>(Promise.resolve());
  onProgressRef.current = onProgress;

  const persistProgress = useCallback(
    (nextProgression: AdaptiveProgressionState, completed = false) => {
      pendingProgressWrite.current = pendingProgressWrite.current
        .catch(() => undefined)
        .then(() => onProgressRef.current?.(nextProgression, completed))
        .then(() => undefined)
        .catch(() => undefined);
      return pendingProgressWrite.current;
    },
    [],
  );
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
    if (currentRunCompleted.current) return;
    void persistProgress(progression);
    void recorder.record("activity_started", {
      activityKind: "game",
      mechanic: activeGame.mechanic,
      ageBand: activeGame.ageBand,
      difficulty: activeGame.difficulty.level,
      adaptiveLevel: progression.adaptiveLevel,
      gameVersion: activeGame.version,
    });
  }, [activeGame, persistProgress, progression, recorder, runKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      void Promise.all([recorder.ensurePersisted(), pendingProgressWrite.current]);
    });
    return () => subscription.remove();
  }, [recorder]);

  const startRun = useCallback((nextGame: Game, nextProgression: AdaptiveProgressionState) => {
    currentRunCompleted.current = false;
    setProgression(nextProgression);
    setActiveGame(nextGame);
    setRunKey((current) => current + 1);
  }, []);

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

        const nextProgression = progressionForGame(
          game,
          nextDifficultyAfterCompletion(
            progression,
            child.ageBand,
            maximumLevel,
            requiredRunsForGame(activeGame, child.ageBand),
          ),
        );
        const reachedFinalLevel =
          progression.adaptiveLevel === maximumLevel && nextProgression.completedRunsAtLevel === 0;
        if (reachedFinalLevel && !continuesAfterMaximumLevel(activeGame)) {
          setProgression(nextProgression);
          void persistProgress(nextProgression, true);
          return;
        }
        const nextVariant = applyDifficultyLevel(
          findGameVariant(games, game, nextProgression.difficulty) ?? game,
          nextProgression.difficulty,
        );
        startRun(
          adaptGameComplexity(
            nextVariant,
            nextProgression.itemCount,
            adaptationIndexForRun(nextVariant, nextProgression),
          ),
          nextProgression,
        );
      } else if (observation.type === "retry") {
        void recorder.record("retry_requested", { stepId: observation.stepId });
        const easierProgression = progressionForGame(
          game,
          activeGame.id === "zuzu-missing-piece-001"
            ? previousZuzuProgression(progression)
            : previousProgression(progression),
        );
        const easierGame = applyDifficultyLevel(
          findGameVariant(games, game, easierProgression.difficulty) ?? game,
          easierProgression.difficulty,
        );
        startRun(
          adaptGameComplexity(
            easierGame,
            easierProgression.itemCount,
            adaptationIndexForRun(easierGame, easierProgression),
          ),
          easierProgression,
        );
        if (activeGame.id === "zuzu-missing-piece-001") {
          void persistProgress(easierProgression);
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
    [
      activeGame,
      child.ageBand,
      game,
      games,
      maximumLevel,
      persistProgress,
      progression,
      recorder,
      startRun,
    ],
  );

  const restart = useCallback(() => {
    const starter = applyDifficultyLevel(
      findGameVariant(games, game, "starter") ?? game,
      "starter",
    );
    const challengeIndex =
      activeGame.id === "nino-sound-rhythm-001" ? 0 : progression.challengeIndex + 1;
    const starterProgression = {
      difficulty: starter.difficulty.level,
      completedRunsAtLevel: 0,
      itemCount: 2,
      challengeIndex,
      adaptiveLevel: 1,
    };
    startRun(
      adaptGameComplexity(starter, 2, adaptationIndexForRun(starter, starterProgression)),
      starterProgression,
    );
  }, [game, games, progression.challengeIndex, startRun]);

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
        await Promise.all([recorder.ensurePersisted(), pendingProgressWrite.current]);
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
        adaptiveLevel={progression.adaptiveLevel}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onInstructionSpoken={(instruction) => spokenInstructions.current.add(instruction)}
        onRestart={restart}
        wasInstructionSpoken={(instruction) => spokenInstructions.current.has(instruction)}
      />
    ) : activeGame.mechanic === "sequence_and_place" ? (
      <SequenceAndPlaceGame
        adaptiveLevel={progression.adaptiveLevel}
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
        adaptiveLevel={progression.adaptiveLevel}
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    ) : activeGame.mechanic === "balloon_counting" ? (
      <BalloonCountingGame
        adaptiveLevel={progression.adaptiveLevel}
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
        adaptiveLevel={progression.adaptiveLevel}
        announceIntro={shouldAnnounceGameIntro(runKey)}
        game={activeGame}
        key={runKey}
        onExit={exit}
        onRestart={restart}
      />
    );

  return <GameObservationProvider report={report}>{screen}</GameObservationProvider>;
}
