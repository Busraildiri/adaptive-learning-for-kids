import type { FishPatternsGame as FishGameContent } from "@adaptive/content-schema";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";
import {
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

export function FishPatternsGame({
  adaptiveLevel,
  announceIntro = true,
  game,
  onExit,
  onRestart,
}: {
  adaptiveLevel: number;
  announceIntro?: boolean;
  game: FishGameContent;
  onExit: () => void;
  onRestart: () => void;
}) {
  const report = useGameObservation();
  const [roundIndex, setRoundIndex] = useState(0);
  const [locked, setLocked] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [entered, setEntered] = useState<string[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [completed, setCompleted] = useState(false);
  const round = game.rounds[roundIndex];
  const visibleFish = round.kind === "color_prediction" ? round.sequence : round.fish;
  const choices = round.kind === "color_prediction" ? round.choices : round.fish;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compactHeight = windowHeight < 720;
  const contentWidth = Math.min(460, Math.max(280, windowWidth - 28));
  const lakeItemCount = visibleFish.length + (round.kind === "color_prediction" ? 1 : 0);
  const lakeColumns = lakeItemCount <= 3 ? lakeItemCount : lakeItemCount <= 6 ? 3 : 4;
  const lakeGap = windowWidth < 360 ? 5 : 8;
  const lakeCellWidth =
    (contentWidth - Math.max(0, lakeColumns - 1) * lakeGap) / Math.max(1, lakeColumns);
  const fishSlotSize = Math.max(54, Math.min(92, lakeCellWidth));
  const lakeRows = Math.ceil(lakeItemCount / Math.max(1, lakeColumns));
  const lakeHeight = lakeRows * fishSlotSize + Math.max(0, lakeRows - 1) * lakeGap;
  const choiceColumns = choices.length <= 3 ? choices.length : choices.length <= 6 ? 3 : 4;
  const choiceWidth =
    (contentWidth - Math.max(0, choiceColumns - 1) * lakeGap) / Math.max(1, choiceColumns);

  const speak = useCallback(
    (text: string, done?: () => void) => {
      if (!game.presentation.playAudioInstructions) return done?.();
      let finished = false;
      const complete = () => {
        if (finished) return;
        finished = true;
        if (fallback) clearTimeout(fallback);
        done?.();
      };
      const fallback = done
        ? setTimeout(complete, Math.max(1800, Math.min(5000, text.length * 90)))
        : undefined;
      void Speech.stop()
        .then(() =>
          Speech.speak(text, {
            language: "tr-TR",
            rate: 0.84,
            onDone: complete,
            onError: complete,
            onStopped: complete,
          }),
        )
        .catch(complete);
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
      roundIndex === 0 && announceIntro
        ? `${game.presentation.introNarration} ${round.prompt}`
        : round.prompt;
    speak(intro, () => (round.kind === "sequence_memory" ? revealMemory() : setLocked(false)));
    return () => void Speech.stop();
  }, [announceIntro, game.presentation.introNarration, revealMemory, round, roundIndex, speak]);

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
      report({ type: "attempt", stepId: round.id, correct: color === round.correctColor });
      if (color !== round.correctColor) return retry();
      setHighlighted(color);
      return finishRound();
    }
    const nextIndex = entered.length;
    report({ type: "attempt", stepId: round.id, correct: color === round.sequence[nextIndex] });
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
        <ScrollView
          bounces={false}
          contentContainerStyle={[styles.content, compactHeight && styles.contentCompact]}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.levelBadge}>
            <Text style={styles.level}>SEVİYE {adaptiveLevel}</Text>
          </View>
          <View style={styles.progress}>
            {game.rounds.map((item, index) => (
              <View key={item.id} style={[styles.dot, index <= roundIndex && styles.dotActive]} />
            ))}
          </View>
          <Text style={[styles.title, compactHeight && styles.titleCompact]}>{game.title}</Text>
          <View style={[styles.promptCard, compactHeight && styles.promptCardCompact]}>
            <Text style={[styles.prompt, compactHeight && styles.promptCompact]}>
              {round.prompt}
            </Text>
            {round.kind === "sequence_memory" && locked ? (
              <Text style={styles.watch}>İyi izle…</Text>
            ) : null}
          </View>
          <View
            style={[styles.lakeRow, { gap: lakeGap, minHeight: lakeHeight, width: contentWidth }]}
          >
            {visibleFish.map((color, index) => (
              <View
                key={`${color}-${index}`}
                style={[
                  styles.fishSlot,
                  {
                    borderRadius: fishSlotSize / 2,
                    height: fishSlotSize,
                    width: fishSlotSize,
                  },
                  highlighted === color && styles.fishHighlighted,
                ]}
              >
                <Image
                  resizeMode="contain"
                  source={fishAssets[color]}
                  style={{ height: fishSlotSize * 0.78, width: fishSlotSize * 0.94 }}
                />
              </View>
            ))}
            {round.kind === "color_prediction" ? (
              <View
                style={[
                  styles.questionFish,
                  {
                    borderRadius: fishSlotSize / 2,
                    height: fishSlotSize,
                    width: fishSlotSize,
                  },
                ]}
              >
                <Text style={[styles.question, { fontSize: fishSlotSize * 0.5 }]}>?</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.choiceRow, { gap: lakeGap, width: contentWidth }]}>
            {choices.map((color) => (
              <Pressable
                accessibilityLabel={`${colorNames[color]} balık`}
                disabled={locked}
                key={color}
                onPress={() => choose(color)}
                style={({ pressed }) => [
                  styles.choice,
                  { minHeight: Math.max(82, choiceWidth * 0.84), width: choiceWidth },
                  pressed && styles.pressed,
                ]}
              >
                <Image
                  resizeMode="contain"
                  source={fishAssets[color]}
                  style={{
                    height: Math.min(67, choiceWidth * 0.58),
                    width: Math.min(88, choiceWidth * 0.76),
                  }}
                />
                <Text style={[styles.choiceText, compactHeight && styles.choiceTextCompact]}>
                  {colorNames[color]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.feedback}>
            {feedback}
          </Text>
        </ScrollView>
        <View pointerEvents="none" style={styles.bubbles}>
          <Text style={styles.bubbleText}>○ · ○</Text>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#92D9F4" },
  background: { flex: 1 },
  backgroundImage: { resizeMode: "cover" },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(220,248,255,0.52)" },
  scroll: { flex: 1, width: "100%" },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  contentCompact: { paddingBottom: 8 },
  closeButton: {
    position: "absolute",
    zIndex: 3,
    top: 14,
    left: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E75252",
  },
  closeText: { color: "#FFFFFF", fontSize: 32, lineHeight: 35 },
  levelBadge: {
    marginTop: 18,
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  progress: { flexDirection: "row", gap: 8, marginTop: 8 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#B7E4ED" },
  dotActive: { backgroundColor: "#087F9B" },
  level: {
    color: "#087F9B",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: { marginTop: 10, color: "#164E63", fontSize: 25, fontWeight: "900", textAlign: "center" },
  titleCompact: { marginTop: 4, fontSize: 22 },
  promptCard: {
    width: "100%",
    maxWidth: 450,
    marginTop: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  prompt: { color: "#234E59", fontSize: 21, fontWeight: "900", textAlign: "center" },
  promptCardCompact: { marginTop: 7, paddingVertical: 9, paddingHorizontal: 12 },
  promptCompact: { fontSize: 18 },
  watch: { marginTop: 4, color: "#D56B32", fontSize: 16, fontWeight: "900", textAlign: "center" },
  lakeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  fishSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  fishHighlighted: {
    backgroundColor: "#FFF18A",
    transform: [{ translateY: -12 }, { scale: 1.12 }],
  },
  questionFish: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#1CA6C4",
  },
  question: { color: "#FFFFFF", fontWeight: "900" },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  choice: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  choiceText: { color: "#225467", fontSize: 16, fontWeight: "900" },
  choiceTextCompact: { fontSize: 14 },
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
