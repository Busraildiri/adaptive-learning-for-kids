import {
  type ActivityEngineEvent,
  type ActivityEngineSnapshot,
  createActivityEngine,
  transition,
} from "@adaptive/activity-engine";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { useEffect, useReducer, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

const activities = [
  {
    scene: "🧸",
    narration: "Ece'nin oyuncağı yere düştü. Sence Ece nasıl hissediyor?",
    feedback: "Oyuncağı düşününce üzgün hissetmesi anlaşılır.",
  },
  {
    scene: "🎈",
    narration: "Mert doğum günü balonlarını gördü. Sence Mert nasıl hissediyor?",
    feedback: "Sevdiğimiz bir sürpriz bizi mutlu edebilir.",
  },
] as const;

const emotions = [
  { id: "happy", emoji: "😊", color: "#f6c453" },
  { id: "sad", emoji: "😢", color: "#79b8d1" },
  { id: "angry", emoji: "😠", color: "#e7826f" },
  { id: "scared", emoji: "😨", color: "#a78bcc" },
] as const;

const TRANSITION_DURATION_MS = 600;
const PREFERRED_TURKISH_VOICE_NAMES = ["yelda", "seda"];

function reducer(snapshot: ActivityEngineSnapshot, event: ActivityEngineEvent) {
  return transition(snapshot, event);
}

export default function App() {
  const [snapshot, dispatch] = useReducer(reducer, undefined, () =>
    createActivityEngine({ responseTimeoutMs: 8_000 }),
  );
  const [activityIndex, setActivityIndex] = useState(0);
  const [voiceIdentifier, setVoiceIdentifier] = useState<string | null | undefined>(undefined);
  const activity = activities[activityIndex];

  useEffect(() => {
    let cancelled = false;

    void Speech.getAvailableVoicesAsync()
      .then((voices) => {
        const turkishVoices = voices.filter((voice) =>
          voice.language.toLowerCase().startsWith("tr"),
        );
        const preferredVoice = turkishVoices.find((voice) =>
          PREFERRED_TURKISH_VOICE_NAMES.some((name) => voice.name.toLowerCase().includes(name)),
        );
        const enhancedVoice = turkishVoices.find((voice) => voice.quality === "Enhanced");

        if (!cancelled) {
          setVoiceIdentifier(preferredVoice?.identifier ?? enhancedVoice?.identifier ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setVoiceIdentifier(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (voiceIdentifier === undefined) return;

    let cancelled = false;
    let event: ActivityEngineEvent | null = null;
    let delay = 0;

    const speak = (text: string, completionEvent: ActivityEngineEvent) => {
      Speech.speak(text, {
        language: "tr-TR",
        pitch: 1.08,
        rate: 1,
        voice: voiceIdentifier ?? undefined,
        onDone: () => {
          if (!cancelled) dispatch(completionEvent);
        },
        onError: () => {
          if (!cancelled) dispatch(completionEvent);
        },
      });
    };

    switch (snapshot.state) {
      case "PLAYING_NARRATION":
        speak(activity.narration, { type: "NARRATION_ENDED" });
        return () => {
          cancelled = true;
          void Speech.stop();
        };
      case "WAITING_FOR_EMOTION":
        event = { type: "RESPONSE_TIMED_OUT" };
        delay = snapshot.config.responseTimeoutMs;
        break;
      case "PLAYING_FEEDBACK":
        speak(activity.feedback, { type: "FEEDBACK_ENDED" });
        return () => {
          cancelled = true;
          void Speech.stop();
        };
      case "WAITING_FOR_REPLAY_TAP":
        event = { type: "REPLAY_WINDOW_EXPIRED" };
        delay = snapshot.config.replayWindowMs;
        break;
      case "REPLAYING":
        speak(activity.narration, { type: "REPLAY_ENDED" });
        return () => {
          cancelled = true;
          void Speech.stop();
        };
      case "TRANSITIONING":
        event = {
          type: "TRANSITION_ENDED",
          hasNextActivity: activityIndex < activities.length - 1,
        };
        delay = TRANSITION_DURATION_MS;
        break;
    }

    if (!event) return;
    const timer = setTimeout(() => {
      if (event.type === "TRANSITION_ENDED" && event.hasNextActivity) {
        setActivityIndex((current) => current + 1);
      }
      dispatch(event);
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activityIndex, snapshot, voiceIdentifier]);

  const canChooseEmotion = snapshot.state === "WAITING_FOR_EMOTION";
  const canReplay = snapshot.state === "WAITING_FOR_REPLAY_TAP";
  const isNarrating = snapshot.state === "PLAYING_NARRATION" || snapshot.state === "REPLAYING";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((activityIndex + 1) / activities.length) * 100}%` },
            ]}
          />
        </View>

        <View style={styles.sceneCard}>
          <Text style={styles.scene}>{activity.scene}</Text>
          <Text style={styles.narration}>{activity.narration}</Text>
          {isNarrating && <Text style={styles.audioIndicator}>🔊</Text>}
          {snapshot.state === "PLAYING_FEEDBACK" && (
            <Text style={styles.feedback}>{activity.feedback}</Text>
          )}
        </View>

        <View
          accessibilityElementsHidden={!canChooseEmotion}
          importantForAccessibility={canChooseEmotion ? "auto" : "no-hide-descendants"}
          pointerEvents={canChooseEmotion ? "auto" : "none"}
          style={[styles.emotionGrid, !canChooseEmotion && styles.disabled]}
        >
          {emotions.map((emotion) => (
            <Pressable
              accessibilityLabel={emotion.id}
              accessibilityRole="button"
              key={emotion.id}
              onPress={() => dispatch({ type: "EMOTION_SELECTED", emotionId: emotion.id })}
              style={({ pressed }) => [
                styles.emotionButton,
                { backgroundColor: emotion.color },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emotion}>{emotion.emoji}</Text>
            </Pressable>
          ))}
        </View>

        {snapshot.state === "COMPLETED" && (
          <View style={styles.completedCard}>
            <Text style={styles.completedEmoji}>🌟</Text>
            <Text style={styles.completedText}>Harika!</Text>
          </View>
        )}

        {canReplay && (
          <Pressable
            accessibilityLabel="Hikâyeyi tekrar dinle"
            accessibilityRole="button"
            onPress={() => dispatch({ type: "REPLAY_TAPPED" })}
            style={({ pressed }) => [styles.replayOverlay, pressed && styles.replayPressed]}
          >
            <Text style={styles.replayIcon}>👆</Text>
            <Text style={styles.replayCount}>{snapshot.replayCount + 1}/2</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff8eb" },
  container: { flex: 1, padding: 24 },
  progressTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#e8ddca",
  },
  progressFill: { height: "100%", borderRadius: 8, backgroundColor: "#4e9f8d" },
  sceneCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
    padding: 24,
    borderRadius: 32,
    backgroundColor: "#ffffff",
  },
  scene: { fontSize: 116 },
  narration: {
    maxWidth: 560,
    marginTop: 22,
    color: "#3e3429",
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 35,
    textAlign: "center",
  },
  audioIndicator: { marginTop: 16, fontSize: 32 },
  feedback: {
    marginTop: 18,
    color: "#246b63",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emotionGrid: { flexDirection: "row", justifyContent: "center", gap: 12 },
  disabled: { opacity: 0.35 },
  emotionButton: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
  },
  pressed: { transform: [{ scale: 0.9 }] },
  emotion: { fontSize: 42 },
  replayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(36, 107, 99, 0.88)",
  },
  replayPressed: { backgroundColor: "rgba(28, 82, 76, 0.94)" },
  replayIcon: { fontSize: 92 },
  replayCount: { marginTop: 16, color: "#ffffff", fontSize: 24, fontWeight: "800" },
  completedCard: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8eb",
  },
  completedEmoji: { fontSize: 120 },
  completedText: { marginTop: 16, color: "#246b63", fontSize: 42, fontWeight: "900" },
});
