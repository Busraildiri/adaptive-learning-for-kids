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
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
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

function FloatingBalloon({
  color,
  index,
  disabled,
  highlighted,
  itemCount,
  onPress,
}: {
  color: string;
  index: number;
  disabled: boolean;
  highlighted: boolean;
  itemCount: number;
  onPress: () => void;
}) {
  const report = useGameObservation();
  const float = useRef(new Animated.Value(0)).current;
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
  const size = itemCount > 16 ? 52 : itemCount > 9 ? 72 : itemCount > 5 ? 100 : 145;
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
          style={[styles.balloon, { width: size, height }]}
        />
      </Pressable>
    </Animated.View>
  );
}

function PopBurst({ itemCount }: { itemCount: number }) {
  const burst = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(burst, { toValue: 1, duration: 520, useNativeDriver: true }).start();
  }, [burst]);
  return (
    <Animated.View
      style={[
        styles.pop,
        itemCount > 9 && styles.compactPop,
        {
          opacity: burst.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
          transform: [
            { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.55] }) },
          ],
        },
      ]}
    >
      <Text style={styles.popText}>✦</Text>
      <Text style={[styles.fragment, styles.fragmentOne]}>●</Text>
      <Text style={[styles.fragment, styles.fragmentTwo]}>◆</Text>
      <Text style={[styles.fragment, styles.fragmentThree]}>▲</Text>
      <Text style={[styles.fragment, styles.fragmentFour]}>●</Text>
    </Animated.View>
  );
}

export function BalloonCountingGame({
  game,
  announceIntro = true,
  onExit,
  onRestart,
}: {
  game: BalloonGameContent;
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
        report({ type: "retry", stepId: round.id });
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
          <View style={styles.finishCard}>
            <Text style={styles.confetti}>✦ ✦ ✦</Text>
            <Text style={styles.finishTitle}>Balon parkı tamamlandı!</Text>
            <Text style={styles.finishCopy}>{game.presentation.closingNarration}</Text>
            <Pressable onPress={onRestart} style={styles.exit}>
              <Text style={styles.exitText}>Tekrar başlamak için dokun</Text>
            </Pressable>
            <Pressable onPress={onExit}>
              <Text style={styles.finishCopy}>Oyunlara dön</Text>
            </Pressable>
          </View>
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
        <View style={styles.dots}>
          {game.rounds.map((item, index) => (
            <View key={item.id} style={[styles.dot, index <= roundIndex && styles.dotOn]} />
          ))}
        </View>
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.prompt}>
          <Text style={styles.promptText}>{round.prompt}</Text>
          <Text style={styles.counter}>
            {popped.length} / {round.targetCount}
          </Text>
        </View>
        <View style={styles.balloonGrid}>
          {round.balloons.map((color, index) =>
            popped.includes(index) ? (
              <PopBurst itemCount={round.balloons.length} key={`${color}-${index}`} />
            ) : (
              <FloatingBalloon
                color={color}
                index={index}
                key={`${color}-${index}`}
                disabled={locked}
                onPress={() => choose(color, index)}
                highlighted={highlight === color}
                itemCount={round.balloons.length}
              />
            ),
          )}
        </View>
        <Text style={styles.feedback}>{locked && !feedback ? "Pofi anlatıyor…" : feedback}</Text>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#B9E5FF" },
  screen: { flex: 1, alignItems: "center", paddingHorizontal: 18 },
  background: { resizeMode: "cover" },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(221,246,255,0.68)" },
  close: {
    position: "absolute",
    top: 28,
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
  dots: { flexDirection: "row", gap: 8, marginTop: 28 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#D7DBDF" },
  dotOn: { backgroundColor: "#F28E2B" },
  title: { marginTop: 12, color: "#4B3C38", fontSize: 26, fontWeight: "900" },
  prompt: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    marginTop: 15,
    padding: 15,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  promptText: { color: "#4B3C38", fontSize: 24, fontWeight: "900", textAlign: "center" },
  counter: { marginTop: 5, color: "#E5722A", fontSize: 20, fontWeight: "900" },
  balloonGrid: {
    width: "100%",
    maxWidth: 308,
    minHeight: 430,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "center",
    justifyContent: "center",
    gap: 12,
  },
  balloonButton: {
    width: 145,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 70,
  },
  balloon: { width: 140, height: 175, resizeMode: "contain" },
  highlight: { backgroundColor: "#FFF29B", transform: [{ scale: 1.08 }] },
  pop: { width: 145, height: 180, alignItems: "center", justifyContent: "center" },
  compactPop: { width: 52, height: 64 },
  popText: { color: "#FFD13D", fontSize: 50 },
  fragment: { position: "absolute", fontSize: 22 },
  fragmentOne: { left: 18, top: 24, color: "#F45B69" },
  fragmentTwo: { right: 17, top: 33, color: "#4D96FF" },
  fragmentThree: { left: 29, bottom: 24, color: "#7BC950" },
  fragmentFour: { right: 25, bottom: 20, color: "#A45DEB" },
  feedback: {
    minHeight: 28,
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
