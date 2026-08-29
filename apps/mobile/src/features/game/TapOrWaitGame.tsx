import type { TapOrWaitGame as TapOrWaitGameContent } from "@adaptive/content-schema";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { useGameObservation } from "./GameObservationContext";
import {
  feedbackForOutcome,
  outcomeForTap,
  outcomeForTimeout,
  ruleForRound,
  type TapOrWaitRoundOutcome,
} from "./tapOrWaitEngine";

type Phase = "intro" | "instruction" | "responding" | "feedback" | "completed";

const MASCOT_ASSETS = {
  "character-mino-happy": require("../../../assets/characters/mino-happy.png"),
} as const;
const FLOWERS = [
  require("../../../assets/game/garden/tulip-v1.png"),
  require("../../../assets/game/garden/sunflower-v1.png"),
  require("../../../assets/game/garden/peony-v1.png"),
  require("../../../assets/game/garden/hydrangea-v1.png"),
  require("../../../assets/game/garden/forget-me-not-v1.png"),
];

export function TapOrWaitGame({
  game,
  onExit,
}: {
  game: TapOrWaitGameContent;
  onExit: () => void;
}) {
  const report = useGameObservation();
  const [phase, setPhase] = useState<Phase>("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [lastOutcome, setLastOutcome] = useState<TapOrWaitRoundOutcome | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [sparkleKey, setSparkleKey] = useState(0);
  const roundResolved = useRef(false);
  const signalScale = useRef(new Animated.Value(1)).current;
  const mascotBounce = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const currentRule = useMemo(() => ruleForRound(game, roundIndex), [game, roundIndex]);
  const completedRounds = phase === "completed" ? game.roundPlan.rounds.length : roundIndex;
  const mascot = game.presentation.mascotAssetId
    ? MASCOT_ASSETS[game.presentation.mascotAssetId as keyof typeof MASCOT_ASSETS]
    : undefined;

  const speak = useCallback((text: string, onDone: () => void) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDone();
    };
    Speech.speak(text, {
      language: "tr-TR",
      pitch: 1.08,
      rate: 0.98,
      onDone: finish,
      onError: finish,
    });
  }, []);

  const celebrate = useCallback(() => {
    setSparkleKey((current) => current + 1);
    sparkle.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(mascotBounce, {
          toValue: -16,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(mascotBounce, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]),
      Animated.timing(sparkle, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [mascotBounce, sparkle]);

  const resolveRound = useCallback(
    (outcome: TapOrWaitRoundOutcome) => {
      if (roundResolved.current) return;
      roundResolved.current = true;
      setLastOutcome(outcome);
      setFeedback(feedbackForOutcome(game, outcome));
      if (outcome === "matched_expected_action") {
        Vibration.vibrate(25);
        celebrate();
      }
      setPhase("feedback");
    },
    [celebrate, game],
  );

  useEffect(() => {
    if (phase !== "intro") return;
    speak(game.presentation.introNarration, () => setPhase("instruction"));
    return () => void Speech.stop();
  }, [game.presentation.introNarration, phase, speak]);

  useEffect(() => {
    if (phase !== "instruction") return;
    setTapCount(0);
    roundResolved.current = false;
    const narration =
      roundIndex === 0 && retryCount === 0 ? currentRule.instruction : currentRule.reminder;
    speak(narration, () => setPhase("responding"));
    return () => void Speech.stop();
  }, [currentRule.instruction, currentRule.reminder, phase, retryCount, roundIndex, speak]);

  useEffect(() => {
    if (phase !== "responding") return;
    const expectedAction = currentRule.expectedAction;
    const isWaiting = expectedAction.type === "wait_without_tap";
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(signalScale, {
          toValue: isWaiting ? 0.92 : 1.06,
          duration: isWaiting ? 850 : 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(signalScale, {
          toValue: 1,
          duration: isWaiting ? 850 : 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    const duration =
      expectedAction.type === "wait_without_tap"
        ? expectedAction.durationMs
        : expectedAction.responseWindowMs;
    const timer = setTimeout(() => {
      report({ type: "wait", stepId: currentRule.id, waitMs: duration });
      resolveRound(outcomeForTimeout(currentRule));
    }, duration);
    return () => {
      clearTimeout(timer);
      pulse.stop();
      signalScale.setValue(1);
    };
  }, [currentRule, phase, resolveRound, signalScale]);

  useEffect(() => {
    if (phase !== "feedback") return;
    speak(feedback, () => {
      if (lastOutcome !== "matched_expected_action" && retryCount === 0) {
        report({ type: "retry", stepId: currentRule.id });
        setRetryCount(1);
        setPhase("instruction");
        return;
      }
      const nextRound = roundIndex + 1;
      setRetryCount(0);
      if (nextRound >= game.roundPlan.rounds.length) {
        report({ type: "completed", stepId: currentRule.id });
        setPhase("completed");
      } else {
        setRoundIndex(nextRound);
        setPhase("instruction");
      }
    });
    return () => void Speech.stop();
  }, [feedback, game.roundPlan.rounds.length, lastOutcome, phase, retryCount, roundIndex, speak]);

  useEffect(() => {
    if (phase !== "completed") return;
    celebrate();
    speak("Bahçeyi birlikte uyandırdık!", () => undefined);
    return () => void Speech.stop();
  }, [celebrate, phase, speak]);

  const handleTap = () => {
    if (phase !== "responding" || roundResolved.current) return;
    Animated.sequence([
      Animated.timing(signalScale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(signalScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    const nextTapCount = tapCount + 1;
    setTapCount(nextTapCount);
    const outcome = outcomeForTap(currentRule, nextTapCount);
    if (outcome) resolveRound(outcome);
  };

  if (phase === "completed") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.completedCard}>
          <View style={styles.balloonRow} accessible={false}>
            <Text style={styles.balloon}>🎈</Text>
            <Text style={styles.balloonHigh}>🎈</Text>
            <Text style={styles.balloon}>🎈</Text>
          </View>
          <Animated.Text
            style={[styles.completedSymbol, { transform: [{ translateY: mascotBounce }] }]}
          >
            ★
          </Animated.Text>
          <Text style={styles.title}>Bahçe uyandı!</Text>
          <View style={styles.flowerRow} accessibilityLabel="Tamamlanan ışık bahçesi">
            {game.roundPlan.rounds.map((_, index) => (
              <Image
                key={`completed-flower-${index}`}
                source={FLOWERS[index % FLOWERS.length]}
                style={styles.completedFlower}
              />
            ))}
          </View>
          <Text style={styles.instruction}>Lila ile bütün ışıkları uyandırdın.</Text>
          <Pressable accessibilityRole="button" onPress={onExit} style={styles.exitButton}>
            <Text style={styles.exitButtonText}>Oyunlara dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const shownInstruction =
    phase === "intro"
      ? game.presentation.introNarration
      : roundIndex === 0 && retryCount === 0
        ? currentRule.instruction
        : currentRule.reminder;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.skyDecor} accessible={false}>
        <Text style={styles.cloud}>☁️</Text>
        <Text style={styles.sun}>☀️</Text>
      </View>
      <Pressable
        accessibilityLabel="Oyun seçimine dön"
        accessibilityRole="button"
        hitSlop={10}
        onPress={onExit}
        style={styles.parentButton}
      >
        <Text style={styles.parentButtonSymbol}>×</Text>
      </Pressable>
      <View style={styles.gameArea}>
        <View style={styles.flowerRow} accessibilityLabel={`${completedRounds} tur tamamlandı`}>
          {game.roundPlan.rounds.map((_, index) =>
            index < completedRounds ? (
              <Image
                key={`flower-${index}`}
                source={FLOWERS[index % FLOWERS.length]}
                style={styles.progressFlowerImage}
              />
            ) : (
              <View key={`flower-${index}`} style={styles.flowerWaiting} />
            ),
          )}
        </View>
        {mascot ? (
          <Animated.View style={{ transform: [{ translateY: mascotBounce }] }}>
            <Image accessibilityIgnoresInvertColors source={mascot} style={styles.mascot} />
          </Animated.View>
        ) : null}
        <Text style={styles.title}>{game.title}</Text>
        <Text style={styles.instruction}>{shownInstruction}</Text>
        <View style={styles.signalStage}>
          <Animated.View style={{ transform: [{ scale: signalScale }] }}>
            <Pressable
              accessibilityLabel={currentRule.stimulus.accessibilityLabel}
              accessibilityRole="button"
              disabled={phase !== "responding"}
              onPress={handleTap}
              style={[styles.signal, { backgroundColor: currentRule.stimulus.color }]}
            >
              <Text style={styles.signalSymbol}>
                {currentRule.expectedAction.type === "wait_without_tap" ? "☾" : "✦"}
              </Text>
            </Pressable>
          </Animated.View>
          <Animated.View
            key={sparkleKey}
            pointerEvents="none"
            style={[
              styles.sparkles,
              {
                opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                transform: [
                  {
                    translateY: sparkle.interpolate({ inputRange: [0, 1], outputRange: [10, -55] }),
                  },
                  {
                    scale: sparkle.interpolate({
                      inputRange: [0, 0.4, 1],
                      outputRange: [0.5, 1.2, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sparkleText}>✦ ･ ✧ ･ ✦</Text>
          </Animated.View>
        </View>
        <Text style={styles.statusText}>
          {phase === "feedback"
            ? feedback
            : `Işık ${roundIndex + 1} / ${game.roundPlan.rounds.length}`}
        </Text>
        {currentRule.expectedAction.type === "wait_without_tap" && phase === "responding" ? (
          <Text style={styles.waitHint}>Şşş… küçük ay dinleniyor</Text>
        ) : null}
      </View>
      <View style={styles.ground} accessible={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, overflow: "hidden", backgroundColor: "#EAF7FF", paddingHorizontal: 20 },
  skyDecor: {
    position: "absolute",
    top: 35,
    right: 24,
    left: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cloud: { fontSize: 42, opacity: 0.72 },
  sun: { fontSize: 48 },
  ground: {
    position: "absolute",
    right: -30,
    bottom: -80,
    left: -30,
    height: 190,
    borderRadius: 100,
    backgroundColor: "#BFE3A8",
  },
  parentButton: {
    position: "absolute",
    zIndex: 2,
    top: 12,
    left: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E75252",
  },
  parentButtonSymbol: { color: "#FFFFFF", fontSize: 32, lineHeight: 35 },
  gameArea: {
    zIndex: 1,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 30,
  },
  flowerRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  progressFlowerImage: { width: 34, height: 42, resizeMode: "contain" },
  completedFlower: { width: 58, height: 92, resizeMode: "contain" },
  flowerWaiting: {
    width: 13,
    height: 13,
    marginHorizontal: 7,
    borderRadius: 7,
    backgroundColor: "#87A987",
  },
  mascot: { width: 104, height: 104, resizeMode: "contain" },
  title: { marginTop: 4, color: "#463A31", fontSize: 27, fontWeight: "900", textAlign: "center" },
  instruction: {
    minHeight: 56,
    maxWidth: 340,
    marginTop: 8,
    color: "#463A31",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 27,
    textAlign: "center",
  },
  signalStage: { width: 230, height: 210, alignItems: "center", justifyContent: "center" },
  signal: {
    width: 174,
    height: 174,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 9,
    borderColor: "#FFFFFF",
    borderRadius: 87,
    shadowColor: "#463A31",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 13,
  },
  signalSymbol: { color: "#FFFFFF", fontSize: 70, fontWeight: "900" },
  sparkles: { position: "absolute", top: 68, alignSelf: "center" },
  sparkleText: { color: "#F3B51B", fontSize: 30, fontWeight: "900" },
  statusText: {
    minHeight: 48,
    maxWidth: 330,
    color: "#5D5147",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  waitHint: { color: "#665B78", fontSize: 15, fontWeight: "700" },
  completedCard: {
    zIndex: 1,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  completedSymbol: { color: "#D08A19", fontSize: 72 },
  balloonRow: {
    position: "absolute",
    top: 70,
    right: 20,
    left: 20,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  balloon: { fontSize: 50 },
  balloonHigh: { marginTop: -28, fontSize: 54 },
  exitButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 24,
    backgroundColor: "#2D8C7C",
  },
  exitButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
});
