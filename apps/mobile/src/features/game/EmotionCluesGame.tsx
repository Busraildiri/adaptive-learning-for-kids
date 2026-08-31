import type {
  EmotionClueRound,
  EmotionCluesGame as EmotionGameContent,
} from "@adaptive/content-schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { isClueChoiceCorrect, isEmotionChoiceCorrect } from "./emotionCluesEngine";
import { GameCompletionCard } from "./GameCompletionCard";
import { useGameObservation } from "./GameObservationContext";

const sceneAssets: Record<EmotionClueRound["sceneAssetKey"], ImageSourcePropType> = {
  "sad-bear": require("../../../assets/game/emotion/sad-bear-v1.png"),
  "happy-rabbit": require("../../../assets/game/emotion/happy-rabbit-v2.png"),
  "angry-fox": require("../../../assets/game/emotion/angry-fox-v1.png"),
  "scared-owl": require("../../../assets/game/emotion/scared-owl-v1.png"),
  "sad-elephant": require("../../../assets/game/emotion/sad-elephant-v1.png"),
};

const emotionChoices = [
  { id: "happy", label: "Mutlu", icon: "emoticon-happy-outline" },
  { id: "sad", label: "Üzgün", icon: "emoticon-sad-outline" },
  { id: "angry", label: "Kızgın", icon: "emoticon-angry-outline" },
  { id: "scared", label: "Korkmuş", icon: "emoticon-frown-outline" },
] as const;

const clueChoices = [
  { id: "mouth", label: "Ağzı", icon: "emoticon-outline" },
  { id: "eyes", label: "Gözleri", icon: "eye-outline" },
  { id: "body", label: "Vücudu", icon: "human-handsup" },
] as const;

export function EmotionCluesGame({
  announceIntro = true,
  game,
  onExit,
  onRestart,
}: {
  announceIntro?: boolean;
  game: EmotionGameContent;
  onExit: () => void;
  onRestart: () => void;
}) {
  const report = useGameObservation();
  const [roundIndex, setRoundIndex] = useState(0);
  const [stage, setStage] = useState<"emotion" | "clue">("emotion");
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [locked, setLocked] = useState(true);
  const [completed, setCompleted] = useState(false);
  const round = game.rounds[roundIndex];

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (!game.presentation.playAudioInstructions) return onDone?.();
      void Speech.stop().then(() =>
        Speech.speak(text, { language: "tr-TR", rate: 0.83, onDone, onStopped: onDone }),
      );
    },
    [game.presentation.playAudioInstructions],
  );

  useEffect(() => {
    setLocked(true);
    setFeedback("");
    setAttempt(0);
    const narration =
      roundIndex === 0 && announceIntro
        ? `${game.presentation.introNarration} ${round.storyPrompt} ${round.emotionPrompt}`
        : `${round.storyPrompt} ${round.emotionPrompt}`;
    speak(narration, () => setLocked(false));
    return () => void Speech.stop();
  }, [announceIntro, game.presentation.introNarration, round, roundIndex, speak]);

  const finishRound = () => {
    if (roundIndex === game.rounds.length - 1) {
      report({ type: "completed", stepId: round.id });
      setCompleted(true);
      speak(game.presentation.closingNarration);
      return;
    }
    setStage("emotion");
    setRoundIndex((value) => value + 1);
  };

  const acceptEmotion = () => {
    Vibration.vibrate(35);
    setLocked(true);
    setFeedback(game.feedback.emotionMatched);
    speak(game.feedback.emotionMatched, () => {
      if (!game.difficulty.askClueQuestion) return finishRound();
      setStage("clue");
      setAttempt(0);
      setFeedback("");
      speak(round.cluePrompt, () => setLocked(false));
    });
  };

  const acceptClue = () => {
    Vibration.vibrate(35);
    setLocked(true);
    setFeedback(game.feedback.clueMatched);
    speak(game.feedback.clueMatched, finishRound);
  };

  const revealCorrectAnswer = () => {
    setLocked(true);
    const correctId = stage === "emotion" ? round.correctEmotion : round.correctClue;
    const source = stage === "emotion" ? emotionChoices : clueChoices;
    const correctLabel = source.find((choice) => choice.id === correctId)?.label ?? "bu seçenek";
    const message = `Doğru cevap: ${correctLabel}.`;
    setFeedback(message);
    speak(message, () => {
      if (stage === "emotion") acceptEmotion();
      else acceptClue();
    });
  };

  const retry = () => {
    report({ type: "retry", stepId: round.id });
    if (attempt >= 2) return revealCorrectAnswer();
    Vibration.vibrate(20);
    setLocked(true);
    setFeedback(game.feedback.retry);
    speak(game.feedback.retry, () => {
      setAttempt((value) => value + 1);
      setLocked(false);
    });
  };

  const chooseEmotion = (choice: EmotionClueRound["correctEmotion"]) => {
    if (locked) return;
    const correct = isEmotionChoiceCorrect(round, choice);
    report({ type: "attempt", stepId: round.id, correct });
    if (!correct) return retry();
    acceptEmotion();
  };

  const chooseClue = (choice: EmotionClueRound["correctClue"]) => {
    if (locked) return;
    const correct = isClueChoiceCorrect(round, choice);
    report({ type: "attempt", stepId: round.id, correct });
    if (!correct) return retry();
    acceptClue();
  };

  useEffect(() => {
    if (locked || completed) return;
    const timeout = setTimeout(() => {
      report({ type: "wait", stepId: round.id, waitMs: 7_000 });
      revealCorrectAnswer();
    }, 7_000);
    return () => clearTimeout(timeout);
  }, [locked, completed, roundIndex, stage, attempt]);

  if (completed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <GameCompletionCard
          message={game.presentation.closingNarration}
          onExit={onExit}
          onRestart={onRestart}
          title={game.title}
        />
      </SafeAreaView>
    );
  }

  const choices = stage === "emotion" ? emotionChoices : clueChoices;
  const prompt = stage === "emotion" ? round.emotionPrompt : round.cluePrompt;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable
        accessibilityLabel="Oyundan çık"
        hitSlop={10}
        onPress={onExit}
        style={styles.closeButton}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <View style={styles.progressRow}>
        {game.rounds.map((item, index) => (
          <View
            key={item.id}
            style={[styles.progressDot, index <= roundIndex && styles.progressDotActive]}
          />
        ))}
      </View>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons color="#7A55B3" name="magnify" size={34} />
        <Text style={styles.title}>{game.title}</Text>
      </View>
      <View style={styles.sceneCard}>
        <Image source={sceneAssets[round.sceneAssetKey]} style={styles.sceneImage} />
        <Text style={styles.storyText}>{round.storyPrompt}</Text>
      </View>
      <View style={styles.promptCard}>
        <Text style={styles.stageLabel}>
          {stage === "emotion" ? "1 · DUYGUYU BUL" : "2 · İPUCUNU BUL"}
        </Text>
        <Text style={styles.prompt}>{prompt}</Text>
      </View>
      <View style={styles.choiceGrid}>
        {choices.map((choice) => (
          <Pressable
            accessibilityLabel={choice.label}
            disabled={locked}
            key={choice.id}
            onPress={() =>
              stage === "emotion"
                ? chooseEmotion(choice.id as EmotionClueRound["correctEmotion"])
                : chooseClue(choice.id as EmotionClueRound["correctClue"])
            }
            style={({ pressed }) => [
              styles.choice,
              stage === "clue" && styles.clueChoice,
              pressed && styles.choicePressed,
              attempt > 0 && styles.retryChoice,
            ]}
          >
            <MaterialCommunityIcons
              color="#5A4674"
              name={choice.icon}
              size={stage === "clue" ? 36 : 43}
            />
            <Text style={[styles.choiceLabel, stage === "clue" && styles.clueChoiceLabel]}>
              {choice.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.feedback}>
        {feedback}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, alignItems: "center", paddingHorizontal: 20, backgroundColor: "#F2ECFF" },
  closeButton: {
    position: "absolute",
    zIndex: 2,
    top: 28,
    left: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E75252",
  },
  closeText: { color: "#FFFFFF", fontSize: 32, lineHeight: 35 },
  progressRow: { flexDirection: "row", gap: 8, marginTop: 28 },
  progressDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#D8CCE9" },
  progressDotActive: { backgroundColor: "#8B68C5" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  title: { color: "#493957", fontSize: 25, fontWeight: "900" },
  sceneCard: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    marginTop: 13,
    padding: 12,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
  },
  sceneImage: { width: "100%", height: 205, resizeMode: "contain" },
  storyText: {
    marginTop: 4,
    color: "#4D4149",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    textAlign: "center",
  },
  promptCard: {
    width: "100%",
    maxWidth: 440,
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#FFF8DB",
  },
  stageLabel: { color: "#A06927", fontSize: 12, fontWeight: "900", textAlign: "center" },
  prompt: { marginTop: 3, color: "#493D39", fontSize: 20, fontWeight: "900", textAlign: "center" },
  choiceGrid: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  choice: {
    width: "47%",
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 21,
    backgroundColor: "#DDD0F2",
  },
  clueChoice: { width: "31%", minHeight: 82, paddingHorizontal: 4 },
  clueChoiceLabel: { fontSize: 14, lineHeight: 17, textAlign: "center" },
  retryChoice: { borderColor: "#F2C86B" },
  choicePressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  choiceLabel: { marginTop: 2, color: "#493957", fontSize: 17, fontWeight: "900" },
  feedback: {
    minHeight: 25,
    marginTop: 8,
    color: "#6F519C",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  finishCard: {
    width: "90%",
    maxWidth: 420,
    alignItems: "center",
    marginTop: 120,
    padding: 30,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
  },
  finishTitle: {
    marginTop: 12,
    color: "#493957",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
  },
  finishText: {
    marginTop: 10,
    color: "#6A5C72",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
  },
  exitButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 27,
    borderRadius: 22,
    backgroundColor: "#7A55B3",
  },
  exitText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
});
