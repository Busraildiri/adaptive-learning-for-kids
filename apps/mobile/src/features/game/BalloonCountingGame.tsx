import type { BalloonCountingGame as BalloonGameContent } from "@adaptive/content-schema";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import { GameCompletionCard } from "./GameCompletionCard";
import { useGameObservation } from "./GameObservationContext";

const park = require("../../../assets/game/balloon/park-balloons-v1.png");
const assets: Record<string, ImageSourcePropType> = {
  red: require("../../../assets/game/balloon/balloon-red-v1.png"),
  blue: require("../../../assets/game/balloon/balloon-blue-v1.png"),
  green: require("../../../assets/game/balloon/balloon-green-v1.png"),
  yellow: require("../../../assets/game/balloon/balloon-yellow-v1.png"),
  orange: require("../../../assets/game/balloon/balloon-orange-v1.png"),
  purple: require("../../../assets/game/balloon/balloon-purple-v1.png"),
  pink: require("../../../assets/game/balloon/balloon-pink-v1.png"),
  cyan: require("../../../assets/game/balloon/balloon-cyan-v1.png"),
  darkGreen: require("../../../assets/game/balloon/balloon-dark-green-v1.png"),
  black: require("../../../assets/game/balloon/balloon-black-v1.png"),
  gray: require("../../../assets/game/balloon/balloon-gray-v1.png"),
  white: require("../../../assets/game/balloon/balloon-white-v1.png"),
};
const names: Record<string, string> = {
  red: "kırmızı",
  blue: "mavi",
  green: "yeşil",
  yellow: "sarı",
  orange: "turuncu",
  purple: "mor",
  pink: "pembe",
  cyan: "turkuaz",
  darkGreen: "koyu yeşil",
  black: "siyah",
  gray: "gri",
  white: "beyaz",
};
const assetVisualScales: Record<string, number> = {
  black: 0.56,
  gray: 0.56,
  white: 0.49,
};

function FloatingBalloon({
  color,
  index,
  disabled,
  highlighted,
  size,
  onPress,
}: {
  color: string;
  index: number;
  disabled: boolean;
  highlighted: boolean;
  size: number;
  onPress: () => void;
}) {
  const report = useGameObservation();
  const float = useRef(new Animated.Value(0)).current;
  const visualScale = assetVisualScales[color] ?? 1;
  const visualWidth = Math.round(size * visualScale);
  const visualHeight = Math.round(size * 1.24 * visualScale);
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 130),
        Animated.timing(float, { toValue: -9, duration: 850 + index * 70, useNativeDriver: true }),
        Animated.timing(float, { toValue: 7, duration: 950 + index * 60, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [float, index]);
  const height = Math.round(size * 1.24);
  return (
    <Animated.View style={{ transform: [{ translateY: float }] }}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={[styles.balloonButton, { width: size, height }, highlighted && styles.highlight]}
      >
        <Image
          source={assets[color]}
          resizeMode="contain"
          style={[styles.balloon, { width: visualWidth, height: visualHeight }]}
        />
      </Pressable>
    </Animated.View>
  );
}

function PopBurst({ size }: { size: number }) {
  const burst = useRef(new Animated.Value(0)).current;
  const height = Math.round(size * 1.24);
  const fragmentSize = Math.max(12, Math.round(size * 0.15));
  useEffect(() => {
    Animated.timing(burst, { toValue: 1, duration: 520, useNativeDriver: true }).start();
  }, [burst]);
  return (
    <Animated.View
      style={[
        styles.pop,
        { width: size, height },
        {
          opacity: burst.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
          transform: [
            { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.55] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.popText, { fontSize: Math.max(24, Math.round(size * 0.36)) }]}>✦</Text>
      <Text
        style={[styles.fragment, styles.fragmentOne, { fontSize: fragmentSize, left: size * 0.12 }]}
      >
        ●
      </Text>
      <Text
        style={[
          styles.fragment,
          styles.fragmentTwo,
          { fontSize: fragmentSize, right: size * 0.11 },
        ]}
      >
        ◆
      </Text>
      <Text
        style={[
          styles.fragment,
          styles.fragmentThree,
          { fontSize: fragmentSize, left: size * 0.2 },
        ]}
      >
        ▲
      </Text>
      <Text
        style={[
          styles.fragment,
          styles.fragmentFour,
          { fontSize: fragmentSize, right: size * 0.17 },
        ]}
      >
        ●
      </Text>
    </Animated.View>
  );
}

export function BalloonCountingGame({
  game,
  adaptiveLevel,
  announceIntro = true,
  onExit,
  onRestart,
}: {
  game: BalloonGameContent;
  adaptiveLevel: number;
  announceIntro?: boolean;
  onExit: () => void;
  onRestart: () => void;
}) {
  const report = useGameObservation();
  const [roundIndex, setRoundIndex] = useState(0);
  const [popped, setPopped] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const [locked, setLocked] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState(false);
  const round = game.rounds[roundIndex];
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const balloonCount = round.balloons.length;
  const columns = balloonCount <= 2 ? 2 : balloonCount <= 6 ? 3 : 4;
  const rows = Math.ceil(balloonCount / columns);
  const gridGap = windowWidth < 360 ? 6 : 9;
  const gridWidth = Math.min(440, Math.max(260, windowWidth - 28));
  const compactHeight = windowHeight < 720;
  const gridHeightBudget = Math.max(220, windowHeight - (compactHeight ? 280 : 330));
  const cellWidth = (gridWidth - gridGap * (columns - 1)) / columns;
  const cellHeight = (gridHeightBudget - gridGap * (rows - 1)) / rows;
  const balloonSize = Math.max(48, Math.min(145, cellWidth, cellHeight / 1.24));
  const balloonHeight = Math.round(balloonSize * 1.24);
  const gridHeight = rows * balloonHeight + Math.max(0, rows - 1) * gridGap;

  const speak = useCallback(
    (text: string, done?: () => void) => {
      if (!game.presentation.playAudioInstructions) return done?.();
      void Speech.stop().then(() =>
        Speech.speak(text, { language: "tr-TR", rate: 0.84, onDone: done, onStopped: done }),
      );
    },
    [game.presentation.playAudioInstructions],
  );

  useEffect(() => {
    setPopped([]);
    setWrong(0);
    setHighlight(null);
    setFeedback("");
    setLocked(true);
    const text =
      roundIndex === 0 && announceIntro
        ? `${game.presentation.introNarration} ${round.prompt}`
        : round.prompt;
    speak(text, () => setLocked(false));
    return () => void Speech.stop();
  }, [announceIntro, game.presentation.introNarration, round, roundIndex, speak]);

  useEffect(() => {
    if (locked || completed) return;
    const timeout = setTimeout(() => {
      report({ type: "wait", stepId: round.id, waitMs: game.difficulty.inactivityHintMs });
      const target =
        round.kind === "color"
          ? round.targetColor
          : round.kind === "order"
            ? round.targetOrder?.[popped.length]
            : round.balloons.find((_, index) => !popped.includes(index));
      setHighlight(target ?? null);
      const message = "Doğru balon parlıyor. Ona dokunabilirsin.";
      setFeedback(message);
      speak(message);
    }, game.difficulty.inactivityHintMs);
    return () => clearTimeout(timeout);
  }, [completed, game.difficulty.inactivityHintMs, locked, popped, round, speak]);

  const finishRound = () => {
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

  const choose = (color: string, index: number) => {
    if (locked || popped.includes(index)) return;
    const expected =
      round.kind === "color"
        ? round.targetColor
        : round.kind === "order"
          ? round.targetOrder?.[popped.length]
          : color;
    report({ type: "attempt", stepId: round.id, correct: color === expected });
    if (color !== expected) {
      if (wrong >= 1) {
        const answer = expected ? names[expected] : "parlayan balon";
        const message = `Doğru cevap ${answer}. Parlayan balona dokun.`;
        setLocked(true);
        setFeedback(message);
        speak(message, () => setLocked(false));
        setHighlight(expected ?? null);
      } else {
        setWrong(1);
        setFeedback(game.feedback.retry);
        speak(game.feedback.retry);
        Vibration.vibrate(20);
      }
      return;
    }
    const next = [...popped, index];
    setPopped(next);
    setHighlight(null);
    Vibration.vibrate(28);
    if (round.kind === "color" || next.length === round.targetCount) setTimeout(finishRound, 520);
  };

  if (completed)
    return (
      <SafeAreaView style={styles.safe}>
        <ImageBackground source={park} style={styles.finish}>
          <GameCompletionCard
            message={game.presentation.closingNarration}
            onExit={onExit}
            onRestart={onRestart}
            title={game.title}
          />
        </ImageBackground>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe}>
      <ImageBackground source={park} style={styles.screen} imageStyle={styles.background}>
        <View style={styles.tint} />
        <Pressable
          accessibilityLabel="Oyundan çık"
          hitSlop={10}
          onPress={onExit}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <ScrollView
          bounces={false}
          contentContainerStyle={[styles.content, compactHeight && styles.contentCompact]}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.dots}>
            {game.rounds.map((item, index) => (
              <View key={item.id} style={[styles.dot, index <= roundIndex && styles.dotOn]} />
            ))}
          </View>
          <Text style={[styles.level, compactHeight && styles.levelCompact]}>
            SEVİYE {adaptiveLevel}
          </Text>
          <Text style={[styles.title, compactHeight && styles.titleCompact]}>{game.title}</Text>
          <View style={[styles.prompt, compactHeight && styles.promptCompact]}>
            <Text style={[styles.promptText, compactHeight && styles.promptTextCompact]}>
              {round.prompt}
            </Text>
            <Text style={[styles.counter, compactHeight && styles.counterCompact]}>
              {popped.length} / {round.targetCount}
            </Text>
          </View>
          <View
            style={[styles.balloonGrid, { gap: gridGap, minHeight: gridHeight, width: gridWidth }]}
          >
            {round.balloons.map((color, index) =>
              popped.includes(index) ? (
                <PopBurst key={`${color}-${index}`} size={balloonSize} />
              ) : (
                <FloatingBalloon
                  color={color}
                  index={index}
                  key={`${color}-${index}`}
                  disabled={locked}
                  onPress={() => choose(color, index)}
                  highlighted={highlight === color}
                  size={balloonSize}
                />
              ),
            )}
          </View>
          <Text style={styles.feedback}>{locked && !feedback ? "Pofi anlatıyor…" : feedback}</Text>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#B9E5FF" },
  screen: { flex: 1 },
  background: { resizeMode: "cover" },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(221,246,255,0.68)" },
  scroll: { flex: 1, width: "100%" },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  contentCompact: { paddingBottom: 8 },
  close: {
    position: "absolute",
    top: 14,
    left: 16,
    zIndex: 3,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E75252",
  },
  closeText: { fontSize: 32, lineHeight: 35, color: "#FFFFFF" },
  dots: { flexDirection: "row", gap: 8, marginTop: 20 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#D7DBDF" },
  dotOn: { backgroundColor: "#F28E2B" },
  level: {
    marginTop: 10,
    color: "#2F7865",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  levelCompact: { marginTop: 5, fontSize: 16 },
  title: { marginTop: 4, color: "#4B3C38", fontSize: 26, fontWeight: "900" },
  titleCompact: { fontSize: 22 },
  prompt: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    marginTop: 15,
    padding: 15,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  promptCompact: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18 },
  promptText: { color: "#4B3C38", fontSize: 24, fontWeight: "900", textAlign: "center" },
  promptTextCompact: { fontSize: 19 },
  counter: { marginTop: 5, color: "#E5722A", fontSize: 20, fontWeight: "900" },
  counterCompact: { marginTop: 2, fontSize: 17 },
  balloonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "center",
    justifyContent: "center",
  },
  balloonButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 70,
  },
  balloon: { width: 140, height: 175, resizeMode: "contain" },
  highlight: { backgroundColor: "#FFF29B", transform: [{ scale: 1.08 }] },
  pop: { alignItems: "center", justifyContent: "center" },
  popText: { color: "#FFD13D", fontSize: 50 },
  fragment: { position: "absolute", fontSize: 22 },
  fragmentOne: { top: "16%", color: "#F45B69" },
  fragmentTwo: { top: "22%", color: "#4D96FF" },
  fragmentThree: { bottom: "16%", color: "#7BC950" },
  fragmentFour: { bottom: "13%", color: "#A45DEB" },
  feedback: {
    minHeight: 28,
    marginTop: 8,
    color: "#754A2D",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  finish: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  finishCard: {
    width: "92%",
    maxWidth: 430,
    alignItems: "center",
    padding: 30,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  confetti: { color: "#F2A52B", fontSize: 50 },
  finishTitle: { color: "#4B3C38", fontSize: 27, fontWeight: "900", textAlign: "center" },
  finishCopy: {
    marginTop: 10,
    color: "#665C57",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
  },
  exit: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
    backgroundColor: "#E5722A",
  },
  exitText: { color: "#fff", fontSize: 17, fontWeight: "900" },
});
