import type { MiniChallengeGame as MiniGameContent } from "@adaptive/content-schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { useGameObservation } from "./GameObservationContext";
import { choicesAfterCorrectAnswer, expectedChoiceId } from "./miniChallengeEngine";

const rhythm: Record<string, ImageSourcePropType> = {
  clap: require("../../../assets/game/rhythm/rhythm-clap-v1.png"),
  bell: require("../../../assets/game/rhythm/rhythm-bell-v1.png"),
  drum: require("../../../assets/game/rhythm/rhythm-drum-v1.png"),
  maracas: require("../../../assets/game/rhythm/rhythm-maracas-v1.png"),
  tambourine: require("../../../assets/game/rhythm/rhythm-tambourine-v1.png"),
  "triangle-instrument": require("../../../assets/game/rhythm/rhythm-triangle-v1.png"),
  xylophone: require("../../../assets/game/rhythm/rhythm-xylophone-v1.png"),
  cymbals: require("../../../assets/game/rhythm/rhythm-cymbals-v1.png"),
  trumpet: require("../../../assets/game/rhythm/rhythm-trumpet-v1.png"),
  guitar: require("../../../assets/game/rhythm/rhythm-guitar-v1.png"),
  "wood-block": require("../../../assets/game/rhythm/rhythm-wood-block-v1.png"),
};

void Promise.all(
  Object.values(rhythm).map((source) => {
    const uri = Image.resolveAssetSource(source).uri;
    return Image.prefetch(uri);
  }),
).catch(() => undefined);

const lumiSounds: Record<string, number> = {
  "cat-sound": require("../../../assets/audio/lumi/cat.mp3"),
  "dog-sound": require("../../../assets/audio/lumi/dog.mp3"),
  "car-sound": require("../../../assets/audio/lumi/car.mp3"),
  "rain-sound": require("../../../assets/audio/lumi/rain.mp3"),
  "bird-sound": require("../../../assets/audio/lumi/bird.mp3"),
};
const illustratedIcons: Record<string, ImageSourcePropType> = {
  "maya-brush": require("../../../assets/game/mini/maya-brush.png"),
  "maya-shirt": require("../../../assets/game/mini/maya-shirt.png"),
  "maya-breakfast": require("../../../assets/game/mini/maya-breakfast.png"),
  "maya-wash-face": require("../../../assets/game/mini/maya-wash-face.png"),
  "maya-comb-hair": require("../../../assets/game/mini/maya-comb-hair.png"),
  "maya-shoes": require("../../../assets/game/mini/maya-shoes.png"),
  "riko-inside": require("../../../assets/game/mini/riko-inside.png"),
  "riko-under": require("../../../assets/game/mini/riko-under.png"),
  "riko-on": require("../../../assets/game/mini/riko-on.png"),
  "zuzu-circle": require("../../../assets/game/mini/zuzu-circle.png"),
  "zuzu-square": require("../../../assets/game/mini/zuzu-square.png"),
  "zuzu-triangle": require("../../../assets/game/mini/zuzu-triangle.png"),
  "zuzu-star": require("../../../assets/game/mini/zuzu-star.png"),
  "kiki-small-apple": require("../../../assets/game/mini/kiki-small-apple.png"),
  "kiki-large-apple": require("../../../assets/game/mini/kiki-large-apple.png"),
  "kiki-small-acorn": require("../../../assets/game/mini/kiki-small-acorn.png"),
  "kiki-large-acorn": require("../../../assets/game/mini/kiki-large-acorn.png"),
};
const icons: Record<string, string> = {
  toothbrush: "toothbrush",
  shirt: "tshirt-crew",
  breakfast: "food-croissant",
  box: "package-variant",
  ball: "basketball",
  chair: "chair-rolling",
  circle: "circle-outline",
  square: "square-outline",
  triangle: "triangle-outline",
  star: "star-outline",
  "small-bear": "teddy-bear",
  "large-bear": "teddy-bear",
  "piko-red-circle": "circle",
  "piko-blue-square": "square",
  "piko-yellow-triangle": "triangle",
  "mavi-cat": "cat",
  "mavi-car": "car-side",
  "mavi-tree": "tree",
  "mavi-boat": "sail-boat",
  "lumi-cat": "cat",
  "lumi-dog": "dog-side",
  "lumi-car": "car-hatchback",
  "lumi-rain": "weather-pouring",
  "lumi-bird": "bird",
  "direction-left": "arrow-left-bold-circle",
  "direction-right": "arrow-right-bold-circle",
  "direction-up": "arrow-up-bold-circle",
  "direction-down": "arrow-down-bold-circle",
};

const iconColors: Record<string, string> = {
  "piko-red-circle": "#EF5350",
  "piko-blue-square": "#42A5F5",
  "piko-yellow-triangle": "#FBC02D",
  "mavi-cat": "#F08A5D",
  "mavi-car": "#4C87D9",
  "mavi-tree": "#4CAF70",
  "mavi-boat": "#29A6B8",
  "lumi-cat": "#F08A5D",
  "lumi-dog": "#A86B3D",
  "lumi-car": "#4C87D9",
  "lumi-rain": "#39A8D8",
  "lumi-bird": "#8E64C5",
  "direction-left": "#6C63B5",
  "direction-right": "#E97955",
  "direction-up": "#3FA66B",
  "direction-down": "#D89D28",
};

function MiniVisual({
  icon,
  rotationDegrees = 0,
  silhouette = false,
  size = 72,
}: {
  icon: string;
  rotationDegrees?: 0 | 90 | 180 | 270;
  silhouette?: boolean;
  size?: number;
}) {
  const image = illustratedIcons[icon] ?? rhythm[icon];
  if (image) {
    return (
      <Image
        source={image}
        style={[
          illustratedIcons[icon]
            ? styles.illustratedImage
            : [styles.rhythmImage, { width: size * 1.5, height: size * 1.25 }],
          { transform: [{ rotate: `${rotationDegrees}deg` }] },
        ]}
        resizeMode="contain"
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name={icons[icon] as never}
      color={silhouette ? "#263342" : (iconColors[icon] ?? "#3E5C66")}
      size={icon === "small-bear" ? 58 : icon === "large-bear" ? 92 : size}
      style={{ opacity: silhouette ? 0.72 : 1, transform: [{ rotate: `${rotationDegrees}deg` }] }}
    />
  );
}

function PatternTrain({ sequence }: { sequence: string[] }) {
  return (
    <View style={styles.trainTrack}>
      {sequence.map((icon, index) => (
        <View key={`${icon}-${index}`} style={styles.trainWagon}>
          <MiniVisual icon={icon} size={sequence.length >= 5 ? 32 : 42} />
          <View style={styles.trainWheelRow}>
            <View style={styles.trainWheel} />
            <View style={styles.trainWheel} />
          </View>
        </View>
      ))}
      <View style={[styles.trainWagon, styles.trainQuestion]}>
        <Text style={styles.trainQuestionText}>?</Text>
        <View style={styles.trainWheelRow}>
          <View style={styles.trainWheel} />
          <View style={styles.trainWheel} />
        </View>
      </View>
    </View>
  );
}

function moveOnMap(position: { column: number; row: number }, direction: string) {
  return {
    column: Math.max(
      0,
      Math.min(2, position.column + (direction === "right" ? 1 : direction === "left" ? -1 : 0)),
    ),
    row: Math.max(
      0,
      Math.min(2, position.row + (direction === "down" ? 1 : direction === "up" ? -1 : 0)),
    ),
  };
}

function DirectionMap({ entered }: { entered: string[] }) {
  const path = entered.reduce<{ column: number; row: number }[]>(
    (positions, direction) => [
      ...positions,
      moveOnMap(positions.at(-1) ?? { column: 1, row: 1 }, direction),
    ],
    [{ column: 1, row: 1 }],
  );
  const position = path.at(-1) ?? { column: 1, row: 1 };
  return (
    <View style={styles.directionMap}>
      {Array.from({ length: 9 }, (_, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const active = position.column === column && position.row === row;
        const visited = path.some((step) => step.column === column && step.row === row);
        const start = column === 1 && row === 1;
        return (
          <View
            key={`${column}-${row}`}
            style={[
              styles.mapCell,
              visited && styles.mapCellVisited,
              active && styles.mapCellActive,
            ]}
          >
            {active ? (
              <MaterialCommunityIcons name="map-marker-circle" color="#E85D4A" size={36} />
            ) : start ? (
              <MaterialCommunityIcons name="home-heart" color="#6E9C65" size={24} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function SpatialAnswerIcon({ position }: { position: string }) {
  return (
    <View style={styles.spatialIcon}>
      <View
        style={[
          styles.spatialBox,
          position === "inside" && styles.spatialBoxInside,
          position === "under" && styles.spatialBoxAbove,
          position === "on" && styles.spatialBoxBelow,
          position === "left" && styles.spatialBoxRight,
          position === "right" && styles.spatialBoxLeft,
          position === "behind" && styles.spatialBoxInside,
          position === "front" && styles.spatialBoxInside,
          position === "near" && styles.spatialBoxLeft,
          position === "far" && styles.spatialBoxRight,
        ]}
      />
      <View
        style={[
          styles.spatialBall,
          position === "inside" && styles.spatialBallInside,
          position === "under" && styles.spatialBallUnder,
          position === "on" && styles.spatialBallOn,
          position === "left" && styles.spatialBallLeft,
          position === "right" && styles.spatialBallRight,
          position === "behind" && styles.spatialBallBehind,
          position === "front" && styles.spatialBallFront,
          position === "near" && styles.spatialBallNear,
          position === "far" && styles.spatialBallFar,
        ]}
      />
    </View>
  );
}

function RikoScene({ icon, position }: { icon: string; position: string }) {
  const image = illustratedIcons[icon];
  return (
    <View style={styles.rikoScene}>
      <Text style={styles.rikoSceneLabel}>Resme dikkatlice bak</Text>
      {image ? (
        <Image source={image} style={styles.rikoSceneImage} />
      ) : (
        <View style={styles.rikoSpatialScene}>
          <View style={styles.rikoSceneBox} />
          <View
            style={[
              styles.rikoSceneBall,
              position === "left" && styles.rikoSceneBallLeft,
              position === "right" && styles.rikoSceneBallRight,
              position === "behind" && styles.rikoSceneBallBehind,
              position === "front" && styles.rikoSceneBallFront,
              position === "near" && styles.rikoSceneBallNear,
              position === "far" && styles.rikoSceneBallFar,
            ]}
          />
        </View>
      )}
    </View>
  );
}

const blockPieces: Record<string, [number, number][]> = {
  "zuzu-circle": [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  "zuzu-square": [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  "zuzu-triangle": [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  "zuzu-star": [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
};

function BlockPiece({ icon, compact = false }: { icon: string; compact?: boolean }) {
  const cells = blockPieces[icon] ?? [];
  const cellOffset = compact ? 20 : 27;
  return (
    <View style={[styles.pieceCanvas, compact && styles.compactPieceCanvas]}>
      {cells.map(([column, row]) => (
        <View
          key={`${column}-${row}`}
          style={[
            styles.pieceCell,
            compact && styles.compactPieceCell,
            { left: column * cellOffset, top: row * cellOffset },
          ]}
        />
      ))}
    </View>
  );
}

const blockPieceOffsets: Record<string, [number, number]> = {
  "zuzu-circle": [1, 1],
  "zuzu-square": [0, 2],
  "zuzu-triangle": [2, 0],
  "zuzu-star": [0, 1],
};

function BlockBoard({ pieceIcon, solved }: { pieceIcon: string; solved: boolean }) {
  const [offsetColumn, offsetRow] = blockPieceOffsets[pieceIcon] ?? [0, 0];
  const holes = new Set(
    (blockPieces[pieceIcon] ?? []).map(
      ([column, row]) => `${column + offsetColumn}-${row + offsetRow}`,
    ),
  );
  return (
    <View style={styles.blockBoard}>
      {Array.from({ length: 16 }, (_, index) => {
        const key = `${index % 4}-${Math.floor(index / 4)}`;
        const hole = holes.has(key);
        return (
          <View
            key={key}
            style={[styles.boardCell, hole && !solved ? styles.boardHole : styles.boardFilled]}
          />
        );
      })}
    </View>
  );
}

export function MiniChallengeGame({
  announceIntro = true,
  game,
  onExit,
  onRestart,
}: {
  announceIntro?: boolean;
  game: MiniGameContent;
  onExit: () => void;
  onRestart: () => void;
}) {
  const report = useGameObservation();
  const soundPlayer = useAudioPlayer(null, { updateInterval: 100 });
  const soundStatus = useAudioPlayerStatus(soundPlayer);
  const [roundIndex, setRoundIndex] = useState(0);
  const [entered, setEntered] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [locked, setLocked] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [tappedChoice, setTappedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState(false);
  const tapFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRequest = useRef(0);
  const soundFinished = useRef<(() => void) | null>(null);
  const transitionInFlight = useRef(false);
  const round = game.rounds[roundIndex];
  const isToko = game.id === "toko-little-map-001";
  const isRiko = game.id === "riko-where-001";
  const isLumi = game.id === "lumi-sound-hunt-001";
  const isZuzu = game.id === "zuzu-missing-piece-001";
  const isZuzuFourChoices = isZuzu && round.choices.length === 4;
  const isExpandedRhythm = round.kind === "rhythm" && round.choices.length > 3;
  const correctChoice = round.choices.find((choice) => choice.id === round.correctSequence[0]);
  const speak = useCallback(
    (text: string, done?: () => void) => {
      if (!game.presentation.playAudioInstructions) return done?.();
      const request = speechRequest.current + 1;
      speechRequest.current = request;
      void (async () => {
        await Speech.stop();
        if (speechRequest.current !== request) return;
        let settled = false;
        const finish = () => {
          if (settled || speechRequest.current !== request) return;
          settled = true;
          done?.();
        };
        Speech.speak(text, {
          language: "tr-TR",
          rate: 0.84,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      })();
    },
    [game.presentation.playAudioInstructions],
  );
  const pauseLumiSoundSafely = useCallback(() => {
    try {
      soundPlayer.pause();
    } catch {
      // The native player may already have been released while the game is closing.
    }
  }, [soundPlayer]);
  const playLumiSound = useCallback(
    (done?: () => void) => {
      const source = lumiSounds[round.id];
      if (!source) return done?.();
      speechRequest.current += 1;
      void Speech.stop();
      try {
        pauseLumiSoundSafely();
        soundFinished.current = done ?? null;
        soundPlayer.replace(source);
        soundPlayer.play();
      } catch {
        soundFinished.current = null;
        done?.();
      }
    },
    [pauseLumiSoundSafely, round.id, soundPlayer],
  );
  useEffect(() => {
    if (!isLumi || !soundStatus.didJustFinish) return;
    const done = soundFinished.current;
    soundFinished.current = null;
    done?.();
  }, [isLumi, soundStatus.didJustFinish]);
  const demonstrate = useCallback(() => {
    if (round.soundCue) {
      setLocked(true);
      if (isLumi) playLumiSound(() => setLocked(false));
      else speak(round.soundCue, () => setLocked(false));
      return;
    }
    if (!round.demoSequence?.length) return setLocked(false);
    setLocked(true);
    round.demoSequence.forEach((id, index) => {
      setTimeout(() => {
        setHighlight(id);
        const label = round.choices.find((choice) => choice.id === id)?.label;
        if (label) Speech.speak(label, { language: "tr-TR", rate: 0.9 });
      }, index * 1000);
      setTimeout(() => setHighlight(null), index * 1000 + 700);
    });
    setTimeout(() => {
      setLocked(false);
    }, round.demoSequence.length * 1000);
  }, [isLumi, playLumiSound, round, speak]);
  useEffect(() => {
    transitionInFlight.current = false;
    setEntered([]);
    setWrong(0);
    setHighlight(null);
    setFeedback("");
    setLocked(true);
    const text =
      round.kind === "rhythm"
        ? round.prompt
        : roundIndex === 0 && announceIntro
          ? `${game.presentation.introNarration} ${round.prompt}`
          : round.prompt;
    speak(text, demonstrate);
    return () => {
      speechRequest.current += 1;
      soundFinished.current = null;
      if (isLumi) pauseLumiSoundSafely();
      void Speech.stop();
    };
  }, [
    demonstrate,
    announceIntro,
    game.presentation.introNarration,
    isLumi,
    pauseLumiSoundSafely,
    round.kind,
    round.prompt,
    roundIndex,
    soundPlayer,
    speak,
  ]);
  useEffect(
    () => () => {
      if (tapFeedbackTimer.current) clearTimeout(tapFeedbackTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (locked || completed) return;
    const timer = setTimeout(() => {
      report({ type: "wait", stepId: round.id, waitMs: game.difficulty.inactivityHintMs });
      const expected = expectedChoiceId(round, entered.length);
      setHighlight(expected ?? null);
      const message = "Doğru seçenek parlıyor. Ona dokunabilirsin.";
      setFeedback(message);
      speak(message);
    }, game.difficulty.inactivityHintMs);
    return () => clearTimeout(timer);
  }, [
    completed,
    entered.length,
    game.difficulty.inactivityHintMs,
    locked,
    round.correctSequence,
    speak,
  ]);
  const finish = () => {
    if (transitionInFlight.current) return;
    transitionInFlight.current = true;
    setLocked(true);
    setFeedback(game.feedback.matched);
    Vibration.vibrate(35);
    speak(game.feedback.matched, () => {
      if (roundIndex === game.rounds.length - 1) {
        report({ type: "completed", stepId: round.id });
        setCompleted(true);
        speak(game.presentation.closingNarration);
      } else setRoundIndex((value) => value + 1);
    });
  };
  const choose = (id: string) => {
    if (locked || transitionInFlight.current) return;
    setTappedChoice(id);
    if (tapFeedbackTimer.current) clearTimeout(tapFeedbackTimer.current);
    tapFeedbackTimer.current = setTimeout(() => setTappedChoice(null), 520);
    const expected = expectedChoiceId(round, entered.length);
    report({ type: "attempt", stepId: round.id, correct: id === expected });
    if (id !== expected) {
      if (wrong >= 1) {
        setHighlight(expected ?? null);
        const label = round.choices.find((choice) => choice.id === expected)?.label;
        const message =
          round.kind === "rhythm"
            ? `Sıradaki ses ${label}. Parlayan seçeneğe dokun.`
            : `Doğru cevap ${label}. Parlayan seçeneğe dokun.`;
        setFeedback(message);
        speak(message);
      } else {
        setWrong(1);
        setFeedback(game.feedback.retry);
        if (game.id === "toko-little-map-001") setLocked(true);
        const replay =
          round.kind === "rhythm"
            ? demonstrate
            : game.id === "toko-little-map-001"
              ? () => speak(round.prompt, () => setLocked(false))
              : undefined;
        speak(game.feedback.retry, replay);
      }
      return;
    }
    const next = choicesAfterCorrectAnswer(round, entered, id);
    setEntered(next);
    setWrong(0);
    setHighlight(null);
    if (game.id === "toko-little-map-001" && next.length < round.correctSequence.length) {
      const label = round.choices.find((choice) => choice.id === id)?.label;
      setFeedback(`${label} yönüne gittin. Sıradaki yönü seç.`);
    }
    Vibration.vibrate(25);
    if (next.length === round.correctSequence.length) finish();
  };
  if (completed)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.finish}>
          <MaterialCommunityIcons name="star-circle" color="#F4B942" size={92} />
          <Text style={styles.finishTitle}>{game.title} tamamlandı!</Text>
          <Text style={styles.copy}>{game.presentation.closingNarration}</Text>
          <Pressable onPress={onRestart} style={styles.exit}>
            <Text style={styles.exitText}>Tekrar başlamak için dokun</Text>
          </Pressable>
          <Pressable onPress={onExit}>
            <Text style={styles.copy}>Oyunlara dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityHint="Oyunu kapatıp oyun listesine döner"
          accessibilityLabel="Oyundan çık"
          accessibilityRole="button"
          hitSlop={16}
          onPress={onExit}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={styles.dots}>
          {game.rounds.map((item, index) => (
            <View key={item.id} style={[styles.dot, index <= roundIndex && styles.dotOn]} />
          ))}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.gameContent}
        showsVerticalScrollIndicator={false}
        style={styles.gameScroll}
      >
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.prompt}>
          <Text style={styles.promptText}>{round.prompt}</Text>
          <Text style={styles.step}>
            {entered.length} / {round.correctSequence.length}
          </Text>
        </View>
        {round.displaySequence ? <PatternTrain sequence={round.displaySequence} /> : null}
        {isRiko ? (
          <RikoScene icon={correctChoice?.icon ?? ""} position={correctChoice?.id ?? ""} />
        ) : null}
        {round.previewIcon ? (
          <View style={styles.shadowPreview}>
            <Text style={styles.previewLabel}>Bunun eşini bul</Text>
            <MiniVisual icon={round.previewIcon} size={82} />
          </View>
        ) : null}
        {round.soundCue || isToko ? (
          <Pressable
            accessibilityLabel={isToko ? "Yönergeyi yeniden dinle" : "Sesi yeniden dinle"}
            disabled={locked}
            onPress={() => {
              if (isToko) {
                setLocked(true);
                setFeedback("Yönergeyi dinle.");
                speak(round.prompt, () => setLocked(false));
                return;
              }
              if (isLumi) {
                setLocked(true);
                setFeedback("Sesi dikkatlice dinle.");
                playLumiSound(() => setLocked(false));
              } else speak(round.soundCue ?? "");
            }}
            style={[styles.soundButton, isToko && styles.tokoSoundButton]}
          >
            <MaterialCommunityIcons name="volume-high" color="#FFFFFF" size={isToko ? 38 : 48} />
            <Text style={styles.soundButtonText}>
              {isToko ? "Yönergeyi dinle" : "Sesi yeniden dinle"}
            </Text>
          </Pressable>
        ) : null}
        {isToko ? <DirectionMap entered={entered} /> : null}
        {isZuzu ? (
          <BlockBoard pieceIcon={correctChoice?.icon ?? ""} solved={entered.length > 0} />
        ) : null}
        <View
          style={[
            styles.choices,
            isZuzu && styles.puzzleChoices,
            isZuzuFourChoices && styles.zuzuFourChoices,
            (round.previewIcon || round.soundCue || game.id === "toko-little-map-001" || isRiko) &&
              styles.compactChoices,
            isToko && styles.tokoChoices,
            isExpandedRhythm && styles.expandedRhythmChoices,
          ]}
        >
          {round.choices.map((choice) => (
            <Pressable
              key={choice.id}
              disabled={locked}
              onPress={() => choose(choice.id)}
              style={({ pressed }) => [
                styles.choice,
                isZuzu && styles.puzzleChoice,
                isZuzuFourChoices && styles.zuzuFourChoice,
                (round.previewIcon || round.soundCue || isToko || isRiko) && styles.compactChoice,
                isToko && styles.tokoChoice,
                isExpandedRhythm && styles.expandedRhythmChoice,
                highlight === choice.id && styles.highlight,
                tappedChoice === choice.id && styles.tappedChoice,
                pressed && styles.choicePressed,
              ]}
            >
              {tappedChoice === choice.id ? (
                <View pointerEvents="none" style={styles.sparkles}>
                  <MaterialCommunityIcons
                    name="star-four-points"
                    color="#FFD54F"
                    size={30}
                    style={styles.sparkleTop}
                  />
                  <MaterialCommunityIcons
                    name="star-four-points"
                    color="#FFFFFF"
                    size={22}
                    style={styles.sparkleRight}
                  />
                  <MaterialCommunityIcons
                    name="star-four-points"
                    color="#FFB74D"
                    size={18}
                    style={styles.sparkleBottom}
                  />
                </View>
              ) : null}
              {isZuzu ? (
                <BlockPiece compact={isZuzuFourChoices} icon={choice.icon} />
              ) : isRiko ? (
                <SpatialAnswerIcon position={choice.id} />
              ) : (
                <MiniVisual
                  icon={choice.icon}
                  rotationDegrees={choice.rotationDegrees}
                  silhouette={choice.silhouette}
                  size={isToko || isExpandedRhythm ? 54 : 72}
                />
              )}
              <Text
                style={[
                  styles.label,
                  isZuzuFourChoices && styles.zuzuFourLabel,
                  isExpandedRhythm && styles.expandedRhythmLabel,
                ]}
              >
                {choice.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.feedback}>{locked && !feedback ? "Dinle ve izle…" : feedback}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: "center", paddingHorizontal: 20, backgroundColor: "#FFF5DF" },
  gameScroll: { width: "100%", flex: 1 },
  gameContent: { alignItems: "center", paddingBottom: 32 },
  topBar: {
    width: "100%",
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  close: {
    position: "absolute",
    zIndex: 3,
    top: 18,
    left: 0,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: "#E75252",
  },
  closeText: { fontSize: 36, lineHeight: 39, color: "#FFFFFF" },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#DDD6CA" },
  dotOn: { backgroundColor: "#F08A5D" },
  title: { marginTop: 16, color: "#493C38", fontSize: 27, fontWeight: "900", textAlign: "center" },
  prompt: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    marginTop: 20,
    padding: 18,
    borderRadius: 25,
    backgroundColor: "#fff",
  },
  promptText: { color: "#493C38", fontSize: 22, fontWeight: "900", textAlign: "center" },
  step: { marginTop: 5, color: "#E16B45", fontSize: 18, fontWeight: "900" },
  trainTrack: {
    width: "100%",
    maxWidth: 520,
    minHeight: 108,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 5,
    marginTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 5,
    borderBottomColor: "#80634D",
  },
  trainWagon: {
    flexBasis: "18%",
    minWidth: 42,
    maxWidth: 67,
    height: 72,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#C97736",
    borderRadius: 15,
    backgroundColor: "#FFE0A3",
  },
  trainQuestion: { borderStyle: "dashed", backgroundColor: "#FFFDF7" },
  trainQuestionText: { color: "#C97736", fontSize: 42, fontWeight: "900" },
  trainWheelRow: {
    position: "absolute",
    left: 9,
    right: 9,
    bottom: -10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trainWheel: { width: 15, height: 15, borderRadius: 8, backgroundColor: "#493C38" },
  shadowPreview: {
    width: 170,
    minHeight: 135,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    padding: 12,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
  },
  previewLabel: { marginBottom: 5, color: "#6A5B88", fontSize: 16, fontWeight: "900" },
  rikoScene: {
    width: 220,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    padding: 10,
    borderWidth: 4,
    borderColor: "#F2C45A",
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
  },
  rikoSceneLabel: { color: "#765532", fontSize: 16, fontWeight: "900" },
  rikoSceneImage: { width: 180, height: 145, resizeMode: "contain" },
  rikoSpatialScene: { position: "relative", width: 180, height: 135, marginTop: 4 },
  rikoSceneBox: {
    position: "absolute",
    top: 43,
    left: 61,
    width: 62,
    height: 50,
    borderWidth: 5,
    borderColor: "#A86B3D",
    borderRadius: 9,
    backgroundColor: "#E6A55F",
  },
  rikoSceneBall: {
    position: "absolute",
    top: 60,
    width: 27,
    height: 27,
    borderWidth: 3,
    borderColor: "#287FA3",
    borderRadius: 14,
    backgroundColor: "#56C5E8",
  },
  rikoSceneBallLeft: { left: 22 },
  rikoSceneBallRight: { right: 22 },
  rikoSceneBallBehind: { top: 48, left: 77, zIndex: -1 },
  rikoSceneBallFront: { top: 66, left: 77, zIndex: 2 },
  rikoSceneBallNear: { top: 87, left: 28, width: 38, height: 38, borderRadius: 19 },
  rikoSceneBallFar: { top: 28, right: 18, width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  spatialIcon: { position: "relative", width: 88, height: 72 },
  spatialBox: {
    position: "absolute",
    left: 19,
    width: 50,
    height: 34,
    borderWidth: 4,
    borderColor: "#A86B3D",
    borderRadius: 7,
    backgroundColor: "#E6A55F",
  },
  spatialBoxInside: { top: 20, backgroundColor: "#F3BD75" },
  spatialBoxAbove: { top: 4 },
  spatialBoxBelow: { bottom: 3 },
  spatialBoxLeft: { top: 20, left: 36 },
  spatialBoxRight: { top: 20, left: 2 },
  spatialBall: {
    position: "absolute",
    left: 34,
    width: 21,
    height: 21,
    zIndex: 2,
    borderWidth: 3,
    borderColor: "#287FA3",
    borderRadius: 11,
    backgroundColor: "#56C5E8",
  },
  spatialBallInside: { top: 27 },
  spatialBallUnder: { bottom: 2 },
  spatialBallOn: { top: 2 },
  spatialBallLeft: { top: 27, left: 4 },
  spatialBallRight: { top: 27, left: 63 },
  spatialBallBehind: { top: 25, zIndex: -1, opacity: 0.72 },
  spatialBallFront: { top: 33, zIndex: 3 },
  spatialBallNear: { top: 43, left: 4, width: 29, height: 29, borderRadius: 15 },
  spatialBallFar: { top: 7, left: 64, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  soundButton: {
    minWidth: 210,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: "#6B62B5",
  },
  soundButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  tokoSoundButton: { minWidth: 190, marginTop: 14, paddingVertical: 10 },
  directionMap: {
    width: 174,
    height: 174,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    padding: 4,
    borderRadius: 22,
    backgroundColor: "#CFE9C9",
  },
  mapCell: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    margin: 1,
    borderWidth: 2,
    borderColor: "#9BC78E",
    borderRadius: 14,
    backgroundColor: "#EEF8E8",
  },
  mapCellVisited: { borderColor: "#8BC47E", backgroundColor: "#DDF1D5" },
  mapCellActive: { borderColor: "#F5A24C", backgroundColor: "#FFF2B8" },
  choices: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    marginTop: 35,
  },
  choice: {
    position: "relative",
    width: "45%",
    minHeight: 165,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderWidth: 4,
    borderColor: "#fff",
    borderRadius: 28,
    backgroundColor: "#DCEEF2",
  },
  puzzleChoices: { marginTop: 18 },
  puzzleChoice: { width: "30%", minHeight: 128, paddingHorizontal: 5 },
  zuzuFourChoices: { flexWrap: "nowrap", gap: 6, marginTop: 14 },
  zuzuFourChoice: {
    width: "22%",
    minHeight: 112,
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 20,
  },
  compactChoices: { marginTop: 18 },
  expandedRhythmChoices: { gap: 8, marginTop: 20 },
  expandedRhythmChoice: { width: "30%", minHeight: 128, paddingHorizontal: 4 },
  compactChoice: { minHeight: 118 },
  tokoChoices: { marginTop: 12, gap: 8 },
  tokoChoice: { width: "47%", minHeight: 96, paddingVertical: 6, paddingHorizontal: 5 },
  highlight: { borderColor: "#FFD45C", backgroundColor: "#FFF3A6", transform: [{ scale: 1.06 }] },
  tappedChoice: {
    borderColor: "#FFCA3A",
    backgroundColor: "#FFF0A6",
    transform: [{ scale: 1.04 }],
  },
  choicePressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  sparkles: { ...StyleSheet.absoluteFillObject, zIndex: 4 },
  sparkleTop: { position: "absolute", top: -12, left: 14 },
  sparkleRight: { position: "absolute", top: 20, right: -8 },
  sparkleBottom: { position: "absolute", right: 22, bottom: -8 },
  rhythmImage: { width: 120, height: 100, resizeMode: "contain" },
  illustratedImage: { width: 142, height: 112, resizeMode: "contain" },
  blockBoard: {
    width: 196,
    height: 196,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 22,
    padding: 6,
    borderRadius: 22,
    backgroundColor: "#313F63",
  },
  boardCell: { width: 42, height: 42, margin: 2, borderRadius: 9, borderWidth: 2 },
  boardFilled: { borderColor: "#4C87D9", backgroundColor: "#65A7F3" },
  boardHole: { borderColor: "#C7D4EB", backgroundColor: "#FFFDF5" },
  pieceCanvas: { position: "relative", width: 82, height: 82 },
  compactPieceCanvas: { width: 62, height: 62 },
  pieceCell: {
    position: "absolute",
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: "#E58B14",
    borderRadius: 6,
    backgroundColor: "#FFD34E",
  },
  compactPieceCell: { width: 19, height: 19, borderRadius: 5 },
  label: { marginTop: 7, color: "#493C38", fontSize: 18, fontWeight: "900", textAlign: "center" },
  expandedRhythmLabel: { minHeight: 32, marginTop: 3, fontSize: 14, lineHeight: 16 },
  zuzuFourLabel: { minHeight: 34, marginTop: 4, fontSize: 14, lineHeight: 17 },
  feedback: {
    minHeight: 30,
    marginTop: 25,
    color: "#80513E",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  finish: {
    width: "90%",
    maxWidth: 430,
    alignItems: "center",
    marginTop: 150,
    padding: 30,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  finishTitle: { color: "#493C38", fontSize: 27, fontWeight: "900", textAlign: "center" },
  copy: { marginTop: 10, color: "#665C57", fontSize: 18, textAlign: "center" },
  exit: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
    backgroundColor: "#E16B45",
  },
  exitText: { color: "#fff", fontSize: 17, fontWeight: "900" },
});
