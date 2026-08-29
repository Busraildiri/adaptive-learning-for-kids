import type { FishPatternsGame as FishGameContent } from "@adaptive/content-schema";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";
import {
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

const aquarium = require("../../../assets/game/fish/aquarium-background-v1.png");
const fishAssets: Record<string, ImageSourcePropType> = {
  red: require("../../../assets/game/fish/fish-red-v1.png"),
  blue: require("../../../assets/game/fish/fish-blue-v1.png"),
  yellow: require("../../../assets/game/fish/fish-yellow-v1.png"),
  teal: require("../../../assets/game/fish/fish-teal-v1.png"),
  green: require("../../../assets/game/fish/fish-green-v1.png"),
  purple: require("../../../assets/game/fish/fish-purple-v1.png"),
  pink: require("../../../assets/game/fish/fish-pink-v1.png"),
  orange: require("../../../assets/game/fish/fish-orange-v1.png"),
};
const colorNames: Record<string, string> = {
  red: "Kırmızı",
  blue: "Mavi",
  yellow: "Sarı",
  teal: "Turkuaz",
  green: "Yeşil",
  purple: "Mor",
  pink: "Pembe",
  orange: "Turuncu",
};

export function FishPatternsGame({ game, onExit }: { game: FishGameContent; onExit: () => void }) {
  const report = useGameObservation();
  const [roundIndex, setRoundIndex] = useState(0);
  const [locked, setLocked] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [entered, setEntered] = useState<string[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [completed, setCompleted] = useState(false);
  const round = game.rounds[roundIndex];

  const speak = useCallback(
    (text: string, done?: () => void) => {
      if (!game.presentation.playAudioInstructions) return done?.();
      void Speech.stop();
      Speech.speak(text, { language: "tr-TR", rate: 0.84, onDone: done, onStopped: done });
    },
    [game.presentation.playAudioInstructions],
  );

  const revealMemory = useCallback(() => {
    if (round.kind !== "sequence_memory") return;
    setLocked(true);
    setEntered([]);
    round.sequence.forEach((color, index) => {
      setTimeout(() => setHighlighted(color), index * (round.revealMs + 220));
      setTimeout(() => setHighlighted(null), index * (round.revealMs + 220) + round.revealMs);
    });
    setTimeout(() => setLocked(false), round.sequence.length * (round.revealMs + 220));
  }, [round]);

  useEffect(() => {
    setFeedback("");
    setEntered([]);
    setWrongAttempts(0);
    setLocked(true);
    const intro =
      roundIndex === 0 ? `${game.presentation.introNarration} ${round.prompt}` : round.prompt;
    speak(intro, () => (round.kind === "sequence_memory" ? revealMemory() : setLocked(false)));
    return () => void Speech.stop();
  }, [game.presentation.introNarration, revealMemory, round, roundIndex, speak]);

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

  const retry = () => {
    report({ type: "retry", stepId: round.id });
    if (wrongAttempts >= 1) {
      setLocked(true);
      const answer =
        round.kind === "color_prediction"
          ? colorNames[round.correctColor]
          : round.sequence.map((color) => colorNames[color]).join(", sonra ");
      const message = `Doğru cevap: ${answer}.`;
      setFeedback(message);
      speak(message, finishRound);
      return;
    }
    setLocked(true);
    setFeedback(game.feedback.retry);
    Vibration.vibrate(20);
    speak(game.feedback.retry, () =>
      round.kind === "sequence_memory" ? revealMemory() : setLocked(false),
    );
    setWrongAttempts((value) => value + 1);
  };

  const choose = (color: string) => {
    if (locked) return;
    if (round.kind === "color_prediction") {
      if (color !== round.correctColor) return retry();
      setHighlighted(color);
      return finishRound();
    }
    const nextIndex = entered.length;
    if (color !== round.sequence[nextIndex]) return retry();
    const next = [...entered, color];
    setEntered(next);
    setHighlighted(color);
    setTimeout(() => setHighlighted(null), 260);
    if (next.length === round.sequence.length) finishRound();
  };

  if (completed)
    return (
      <SafeAreaView style={styles.safeArea}>
        <ImageBackground
          imageStyle={styles.finishBackgroundImage}
          source={aquarium}
          style={styles.finishBackground}
        >
          <View style={styles.finishGlow} />
          <Text style={[styles.sparkle, styles.sparkleLeft]}>✦</Text>
          <Text style={[styles.sparkle, styles.sparkleRight]}>✦</Text>
          <View style={styles.finishCard}>
            <Text style={styles.finishIcon}>✦</Text>
            <Text style={styles.finishTitle}>Göl tamamlandı!</Text>
            <Text style={styles.finishCopy}>{game.presentation.closingNarration}</Text>
            <Pressable onPress={onExit} style={styles.exitButton}>
              <Text style={styles.exitText}>Oyunlara dön</Text>
            </Pressable>
          </View>
        </ImageBackground>
      </SafeAreaView>
    );

  const visibleFish = round.kind === "color_prediction" ? round.sequence : round.fish;
  const choices = round.kind === "color_prediction" ? round.choices : round.fish;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={aquarium}
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.tint} />
        <Pressable
          accessibilityLabel="Oyundan çık"
          hitSlop={10}
          onPress={onExit}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={styles.progress}>
          {game.rounds.map((item, index) => (
            <View key={item.id} style={[styles.dot, index <= roundIndex && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.promptCard}>
          <Text style={styles.prompt}>{round.prompt}</Text>
          {round.kind === "sequence_memory" && locked ? (
            <Text style={styles.watch}>İyi izle…</Text>
          ) : null}
        </View>
        <View style={styles.lakeRow}>
          {visibleFish.map((color, index) => (
            <View
              key={`${color}-${index}`}
              style={[styles.fishSlot, highlighted === color && styles.fishHighlighted]}
            >
              <Image source={fishAssets[color]} style={styles.fish} />
              {round.kind === "color_prediction" && index < visibleFish.length - 1 ? null : null}
            </View>
          ))}
          {round.kind === "color_prediction" ? (
            <View style={styles.questionFish}>
              <Text style={styles.question}>?</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.choiceRow}>
          {choices.map((color) => (
            <Pressable
              accessibilityLabel={`${colorNames[color]} balık`}
              disabled={locked}
              key={color}
              onPress={() => choose(color)}
              style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
            >
              <Image source={fishAssets[color]} style={styles.choiceFish} />
              <Text style={styles.choiceText}>{colorNames[color]}</Text>
            </Pressable>
          ))}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.feedback}>
          {feedback}
        </Text>
        <View pointerEvents="none" style={styles.bubbles}>
          <Text style={styles.bubbleText}>○ · ○</Text>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#92D9F4" },
  background: { flex: 1, alignItems: "center", paddingHorizontal: 16 },
  backgroundImage: { resizeMode: "cover" },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(220,248,255,0.52)" },
  closeButton: {
    position: "absolute",
    zIndex: 3,
    top: 12,
    left: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E75252",
  },
  closeText: { color: "#FFFFFF", fontSize: 32, lineHeight: 35 },
  progress: { flexDirection: "row", gap: 8, marginTop: 27 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#B7E4ED" },
  dotActive: { backgroundColor: "#087F9B" },
  title: { marginTop: 10, color: "#164E63", fontSize: 25, fontWeight: "900", textAlign: "center" },
  promptCard: {
    width: "100%",
    maxWidth: 450,
    marginTop: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  prompt: { color: "#234E59", fontSize: 21, fontWeight: "900", textAlign: "center" },
  watch: { marginTop: 4, color: "#D56B32", fontSize: 16, fontWeight: "900", textAlign: "center" },
  lakeRow: {
    width: "100%",
    maxWidth: 500,
    minHeight: 180,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 18,
  },
  fishSlot: {
    width: 78,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
  },
  fishHighlighted: {
    backgroundColor: "#FFF18A",
    transform: [{ translateY: -12 }, { scale: 1.12 }],
  },
  fish: { width: 76, height: 62, resizeMode: "contain" },
  questionFish: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 33,
    backgroundColor: "#1CA6C4",
  },
  question: { color: "#FFFFFF", fontSize: 38, fontWeight: "900" },
  choiceRow: {
    width: "100%",
    maxWidth: 460,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  choice: {
    flex: 1,
    maxWidth: 135,
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  choiceFish: { width: 88, height: 67, resizeMode: "contain" },
  choiceText: { color: "#225467", fontSize: 16, fontWeight: "900" },
  feedback: {
    minHeight: 26,
    marginTop: 12,
    color: "#104F60",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  bubbles: { position: "absolute", left: 28, bottom: 30 },
  bubbleText: { color: "rgba(255,255,255,0.8)", fontSize: 33 },
  finishBackground: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  finishBackgroundImage: { resizeMode: "cover" },
  finishGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(118, 218, 239, 0.24)",
  },
  sparkle: {
    position: "absolute",
    color: "#FFF7A8",
    fontSize: 46,
    textShadowColor: "rgba(255, 210, 62, 0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  sparkleLeft: { left: 36, top: "23%" },
  sparkleRight: { right: 34, bottom: "22%" },
  finishCard: {
    width: "90%",
    maxWidth: 430,
    alignItems: "center",
    padding: 30,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#07596D",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
  },
  finishIcon: {
    color: "#F5C84A",
    fontSize: 76,
    lineHeight: 82,
    textShadowColor: "rgba(245, 200, 74, 0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  finishTitle: { color: "#174E5D", fontSize: 28, fontWeight: "900" },
  finishCopy: {
    marginTop: 10,
    color: "#53666B",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
  },
  exitButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
    backgroundColor: "#087F9B",
  },
  exitText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
});
