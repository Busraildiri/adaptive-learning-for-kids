import {
  contentVersionSchema,
  type EmotionId,
  type HelpAction,
  type Story,
  type StoryStep,
} from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import type { ChildSessionProfile } from "@adaptive/shared-types";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createActivityEventRecorder } from "../../services/interactionEvents";
import { getEmotionPresentation } from "./emotionPresentation";

const content = contentVersionSchema.parse(contentV1);
const CHARACTER_ASSETS: Record<string, ImageSourcePropType> = {
  "character-mino-happy": require("../../../assets/characters/mino-happy.png"),
  "character-mino-sad": require("../../../assets/characters/mino-sad-v2.png"),
  "character-mirmir-red-balloon-happy": require("../../../assets/characters/mirmir-happy.jpg"),
  "character-mirmir-red-balloon-sad": require("../../../assets/characters/mirmir-sad.jpg"),
};
const VIDEO_ASSETS: Record<string, number> = {
  "character-mirmir-red-balloon-playing-video": require("../../../assets/characters/mirmir-balloon.mp4"),
};

const PREFERRED_TURKISH_VOICE_NAMES = ["yelda", "seda"];
type PlayerMode =
  | "GREETING"
  | "PLAYING_PROMPT"
  | "WAITING_FOR_INPUT"
  | "PLAYING_RESPONSE"
  | "BREATHING"
  | "COMPLETED";

function renderTemplate(template: string, child: ChildSessionProfile): string {
  return template.replaceAll("{{childName}}", child.nickname);
}

function getStepNarration(step: StoryStep): string {
  switch (step.type) {
    case "choice":
    case "tap":
    case "emotion_choice":
    case "help_choice":
      return step.prompt;
    case "event":
    case "breathing":
    case "closing":
      return step.narration;
  }
}

function getCharacterAsset(assetId: string): ImageSourcePropType {
  const source = CHARACTER_ASSETS[assetId];

  if (!source) {
    throw new Error(`Missing bundled character asset: ${assetId}`);
  }

  return source;
}

function getVideoAsset(assetId: string): number {
  const source = VIDEO_ASSETS[assetId];
  if (!source) throw new Error(`Missing bundled video asset: ${assetId}`);
  return source;
}

function StoryIntroVideo({ assetId }: { assetId: string }) {
  const player = useVideoPlayer(getVideoAsset(assetId), (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <View style={styles.mediaFrame}>
      <VideoView
        allowsFullscreen={false}
        contentFit="cover"
        nativeControls={false}
        player={player}
        style={styles.mediaFill}
      />
    </View>
  );
}

function Balloon({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <View style={[styles.balloonWrap, { transform: [{ scale }] }]}>
      <View style={[styles.balloon, { backgroundColor: color }]} />
      <View style={[styles.balloonKnot, { borderTopColor: color }]} />
      <View style={styles.balloonString} />
    </View>
  );
}

function EmotionFace({ emotion }: { emotion: EmotionId }) {
  const presentation = getEmotionPresentation(emotion, content.assets);

  return (
    <View
      accessibilityLabel={presentation.accessibilityLabel}
      style={[
        styles.emotionChoiceContent,
        {
          backgroundColor: presentation.backgroundColor,
          borderColor: presentation.borderColor,
          borderRadius: presentation.borderRadius,
        },
      ]}
    >
      <Text style={styles.emotionSymbol}>{presentation.symbol}</Text>
    </View>
  );
}

function HelpVisual({ action }: { action: HelpAction }) {
  if (action === "hug") {
    return <Text style={styles.heart}>♥</Text>;
  }

  if (action === "new_balloon") {
    return <Balloon color="#F46F5E" scale={0.55} />;
  }

  return (
    <View style={styles.breatheIcon}>
      <View style={styles.breatheFace}>
        <View style={styles.closedEyesRow}>
          <View style={styles.closedEye} />
          <View style={styles.closedEye} />
        </View>
        <View style={styles.breatheMouth} />
      </View>
      <View style={styles.breathLines}>
        <View style={styles.breathLineShort} />
        <View style={styles.breathLineLong} />
        <View style={styles.breathLineShort} />
      </View>
    </View>
  );
}

export function MinoStory({
  child,
  story,
  onRequestParentArea,
  onRequestStorySelection,
}: {
  child: ChildSessionProfile;
  story: Story;
  onRequestParentArea: () => void;
  onRequestStorySelection: () => void;
}) {
  const [mode, setMode] = useState<PlayerMode>("GREETING");
  const [stepIndex, setStepIndex] = useState(-1);
  const [pendingNarration, setPendingNarration] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#F46F5E");
  const [selectedHelp, setSelectedHelp] = useState<HelpAction | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [runId, setRunId] = useState(0);
  const [voiceIdentifier, setVoiceIdentifier] = useState<string | null | undefined>(undefined);
  const balloonBounce = useRef(new Animated.Value(0.74)).current;
  const breathScale = useRef(new Animated.Value(0.7)).current;
  const recordedSteps = useRef(new Set<string>());
  const recorder = useMemo(
    () =>
      createActivityEventRecorder({
        childId: child.id,
        activityId: story.id,
        enabled: child.learningObservationsEnabled,
      }),
    [child.id, child.learningObservationsEnabled, runId],
  );
  const currentStep = stepIndex >= 0 ? story.steps[stepIndex] : undefined;
  const eventStepIndex = story.steps.findIndex((step) => step.type === "event");
  const recoveryStepIndex = story.steps.findIndex(
    (step, index) =>
      index > eventStepIndex &&
      (step.type === "help_choice" || step.type === "breathing" || step.type === "closing"),
  );
  const sceneAsset = content.assets.find((asset) => asset.id === story.sceneAssetId);
  const sceneSymbol =
    sceneAsset?.type === "symbol" && sceneAsset.uri.startsWith("emoji:")
      ? sceneAsset.uri.slice("emoji:".length)
      : null;

  useEffect(() => {
    void recorder.record("activity_started", { contentVersion: content.contentVersion });
  }, [recorder]);

  useEffect(() => {
    if (!currentStep || mode !== "WAITING_FOR_INPUT" || recordedSteps.current.has(currentStep.id)) {
      return;
    }
    recordedSteps.current.add(currentStep.id);
    void recorder.record("step_presented", { stepId: currentStep.id, stepType: currentStep.type });
  }, [currentStep, mode, recorder]);

  useEffect(() => {
    if (mode === "COMPLETED") void recorder.record("activity_completed");
  }, [mode, recorder]);

  const advanceStep = useCallback(() => {
    setPendingNarration(null);
    setTapCount(0);
    setStepIndex((current) => {
      const next = current + 1;

      if (next >= story.steps.length) {
        setMode("COMPLETED");
        return current;
      }

      setMode("PLAYING_PROMPT");
      return next;
    });
  }, []);

  const playResponse = (narration: string) => {
    setPendingNarration(narration);
    setMode("PLAYING_RESPONSE");
  };

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
    if (voiceIdentifier === undefined || mode === "WAITING_FOR_INPUT" || mode === "BREATHING") {
      return;
    }

    if (mode === "COMPLETED") return;

    const narration =
      mode === "GREETING"
        ? renderTemplate(story.greetingTemplate, child)
        : mode === "PLAYING_RESPONSE"
          ? pendingNarration
          : currentStep
            ? getStepNarration(currentStep)
            : null;

    if (!narration) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onNarrationEnded = () => {
      if (cancelled) return;

      if (mode === "GREETING") {
        setStepIndex(0);
        setMode("PLAYING_PROMPT");
        return;
      }

      if (mode === "PLAYING_RESPONSE") {
        advanceStep();
        return;
      }

      if (!currentStep) return;

      if (currentStep.type === "event") {
        timer = setTimeout(advanceStep, 650);
      } else if (currentStep.type === "breathing") {
        setMode("BREATHING");
      } else if (currentStep.type === "closing") {
        setMode("COMPLETED");
      } else {
        setMode("WAITING_FOR_INPUT");
      }
    };

    Speech.speak(narration, {
      language: "tr-TR",
      pitch: 1.07,
      rate: 0.94,
      voice: voiceIdentifier ?? undefined,
      onDone: onNarrationEnded,
      onError: onNarrationEnded,
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void Speech.stop();
    };
  }, [advanceStep, child, currentStep, mode, pendingNarration, voiceIdentifier]);

  useEffect(() => {
    if (mode !== "BREATHING" || currentStep?.type !== "breathing") return;

    breathScale.setValue(0.7);
    const movements = Array.from({ length: currentStep.cycles }, () => [
      Animated.timing(breathScale, {
        toValue: 1.18,
        duration: 1_700,
        useNativeDriver: true,
      }),
      Animated.timing(breathScale, {
        toValue: 0.7,
        duration: 1_700,
        useNativeDriver: true,
      }),
    ]).flat();
    const animation = Animated.sequence(movements);

    animation.start(({ finished }) => {
      if (finished) advanceStep();
    });

    return () => animation.stop();
  }, [advanceStep, breathScale, currentStep, mode]);

  const handlePump = () => {
    if (mode !== "WAITING_FOR_INPUT" || currentStep?.type !== "tap") return;

    const nextTapCount = Math.min(tapCount + 1, currentStep.requiredTaps);
    setTapCount(nextTapCount);
    Animated.spring(balloonBounce, {
      toValue: 0.74 + nextTapCount * 0.18,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();

    if (nextTapCount === currentStep.requiredTaps) {
      playResponse(currentStep.completionNarration);
    }
  };

  const resetStory = () => {
    void Speech.stop();
    setStepIndex(-1);
    setPendingNarration(null);
    setSelectedColor("#F46F5E");
    setSelectedHelp(null);
    setTapCount(0);
    balloonBounce.setValue(0.74);
    breathScale.setValue(0.7);
    recordedSteps.current.clear();
    setRunId((current) => current + 1);
    setMode("GREETING");
  };

  const isSad =
    eventStepIndex >= 0 &&
    stepIndex >= eventStepIndex &&
    (recoveryStepIndex < 0 ||
      stepIndex < recoveryStepIndex ||
      (stepIndex === recoveryStepIndex && currentStep?.type === "help_choice" && !selectedHelp));
  const characterAssetId = isSad
    ? story.characterAssets.sadAssetId
    : story.characterAssets.happyAssetId;
  const characterLabel = content.assets.find(
    (asset) => asset.id === characterAssetId,
  )?.accessibilityLabel;
  const characterAsset = content.assets.find((asset) => asset.id === characterAssetId);
  const showIntroVideo = mode === "GREETING" && Boolean(story.introVideoAssetId);
  const prompt = currentStep ? getStepNarration(currentStep) : "";
  const isSpeaking =
    mode === "GREETING" || mode === "PLAYING_PROMPT" || mode === "PLAYING_RESPONSE";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobBottom} />

        {currentStep?.type === "tap" && mode === "WAITING_FOR_INPUT" && (
          <Pressable
            accessibilityLabel="Balonu şişirmek için ekrana dokun"
            accessibilityRole="button"
            onPress={handlePump}
            style={styles.tapOverlay}
          />
        )}

        <Pressable
          accessibilityLabel="Ebeveyn alanına dön"
          accessibilityRole="button"
          onPress={() => {
            if (mode !== "COMPLETED") void recorder.record("activity_abandoned", { stepIndex });
            onRequestParentArea();
          }}
          style={styles.parentGateButton}
        >
          <Text style={styles.parentGateSymbol}>●</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Hikâyeyi kapat"
          accessibilityRole="button"
          onPress={() => {
            if (mode !== "COMPLETED") void recorder.record("activity_abandoned", { stepIndex });
            onRequestStorySelection();
          }}
          style={styles.storySelectionButton}
        >
          <Text style={styles.storySelectionSymbol}>×</Text>
        </Pressable>

        <View style={styles.progressRow}>
          {story.steps.map((step, index) => (
            <View
              key={step.id}
              style={[styles.progressDot, index <= stepIndex && styles.progressDotActive]}
            />
          ))}
        </View>

        <View style={styles.scene}>
          {showIntroVideo && story.introVideoAssetId ? (
            <StoryIntroVideo assetId={story.introVideoAssetId} />
          ) : characterAsset?.presentation?.fit === "cover" ? (
            <View style={styles.mediaFrame}>
              <Image
                accessibilityLabel={characterLabel}
                resizeMode="cover"
                source={getCharacterAsset(characterAssetId)}
                style={styles.mediaFill}
              />
            </View>
          ) : (
            <Image
              accessibilityLabel={characterLabel}
              resizeMode="contain"
              source={getCharacterAsset(characterAssetId)}
              style={styles.character}
            />
          )}

          {sceneSymbol && (
            <Text accessibilityLabel={sceneAsset?.accessibilityLabel} style={styles.sceneSymbol}>
              {sceneSymbol}
            </Text>
          )}

          {currentStep?.type === "tap" && (
            <View pointerEvents="none" style={styles.pumpTarget}>
              <Animated.View style={{ transform: [{ scale: balloonBounce }] }}>
                <Balloon color={selectedColor} />
              </Animated.View>
            </View>
          )}

          {story.id === "mino-balloon-story" && currentStep?.type === "event" && (
            <View style={styles.popBurst} />
          )}

          {mode === "BREATHING" && (
            <Animated.View style={[styles.breathBubble, { transform: [{ scale: breathScale }] }]} />
          )}
        </View>

        <View style={styles.promptCard}>
          <Text style={styles.promptText}>
            {mode === "GREETING" ? renderTemplate(story.greetingTemplate, child) : prompt}
          </Text>
          {isSpeaking && <View style={styles.speakingPulse} />}
        </View>

        {currentStep?.type === "choice" && (
          <View style={styles.choiceRow}>
            {currentStep.choices.map((choice) => (
              <Pressable
                accessibilityLabel={choice.accessibilityLabel}
                accessibilityRole="button"
                disabled={mode !== "WAITING_FOR_INPUT"}
                key={choice.id}
                onPress={() => {
                  void recorder.record("choice_selected", {
                    stepId: currentStep.id,
                    choiceId: choice.id,
                  });
                  setSelectedColor(choice.visual.color);
                  playResponse(choice.acknowledgement);
                }}
                style={({ pressed }) => [
                  styles.visualChoice,
                  mode !== "WAITING_FOR_INPUT" && styles.disabledChoice,
                  pressed && styles.pressed,
                ]}
              >
                <Balloon color={choice.visual.color} scale={0.78} />
              </Pressable>
            ))}
          </View>
        )}

        {currentStep?.type === "emotion_choice" && (
          <View style={styles.choiceRow}>
            {currentStep.choices.map((choice) => (
              <Pressable
                accessibilityLabel={choice.accessibilityLabel}
                accessibilityRole="button"
                disabled={mode !== "WAITING_FOR_INPUT"}
                key={choice.id}
                onPress={() => {
                  void recorder.record("choice_selected", {
                    stepId: currentStep.id,
                    choiceId: choice.id,
                  });
                  playResponse(
                    `${choice.supportiveFeedback.narration} ${currentStep.storyResolution.narration}`,
                  );
                }}
                style={({ pressed }) => [
                  styles.visualChoice,
                  mode !== "WAITING_FOR_INPUT" && styles.disabledChoice,
                  pressed && styles.pressed,
                ]}
              >
                <EmotionFace emotion={choice.emotion} />
              </Pressable>
            ))}
          </View>
        )}

        {currentStep?.type === "help_choice" && (
          <View style={styles.helpRow}>
            {currentStep.choices.map((choice) => (
              <Pressable
                accessibilityLabel={choice.accessibilityLabel}
                accessibilityRole="button"
                disabled={mode !== "WAITING_FOR_INPUT"}
                key={choice.id}
                onPress={() => {
                  void recorder.record("hint_requested", {
                    stepId: currentStep.id,
                    action: choice.action,
                  });
                  setSelectedHelp(choice.action);
                  playResponse(choice.resultNarration);
                }}
                style={({ pressed }) => [
                  styles.helpChoice,
                  mode !== "WAITING_FOR_INPUT" && styles.disabledChoice,
                  pressed && styles.pressed,
                ]}
              >
                <HelpVisual action={choice.action} />
              </Pressable>
            ))}
          </View>
        )}

        {mode === "COMPLETED" && (
          <Pressable
            accessibilityLabel="Hikâyeyi yeniden oyna"
            accessibilityRole="button"
            onPress={resetStory}
            style={({ pressed }) => [styles.completedOverlay, pressed && styles.completedPressed]}
          >
            <Image
              resizeMode="contain"
              source={getCharacterAsset(story.characterAssets.happyAssetId)}
              style={styles.completedCharacter}
            />
            <View style={styles.replayCircle}>
              <Text style={styles.replaySymbol}>↻</Text>
            </View>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF6E8" },
  container: {
    flex: 1,
    alignItems: "center",
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backgroundBlobTop: {
    position: "absolute",
    top: -150,
    right: -110,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "#FFD9C8",
  },
  backgroundBlobBottom: {
    position: "absolute",
    bottom: -190,
    left: -140,
    width: 390,
    height: 390,
    borderRadius: 195,
    backgroundColor: "#CDEBE4",
  },
  progressRow: { flexDirection: "row", gap: 7, zIndex: 2 },
  tapOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  parentGateButton: {
    position: "absolute",
    top: 8,
    right: 14,
    zIndex: 30,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#FFFFFFCC",
  },
  parentGateSymbol: { color: "#887867", fontSize: 18 },
  storySelectionButton: {
    position: "absolute",
    top: 8,
    left: 14,
    zIndex: 30,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 24,
    backgroundColor: "#E94F4F",
  },
  storySelectionSymbol: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", lineHeight: 38 },
  progressDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#DDCFBE" },
  progressDotActive: { width: 24, backgroundColor: "#2D8C7C" },
  scene: {
    flex: 1,
    width: "100%",
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  character: { width: "80%", height: "95%" },
  mediaFrame: {
    width: "78%",
    height: "92%",
    maxWidth: 420,
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#F5D9C8",
    shadowColor: "#7B6149",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  mediaFill: { width: "100%", height: "100%" },
  sceneSymbol: {
    position: "absolute",
    right: "6%",
    top: "9%",
    fontSize: 68,
  },
  pumpTarget: { position: "absolute", right: "5%", top: "13%", padding: 18 },
  balloonWrap: { width: 105, height: 155, alignItems: "center" },
  balloon: {
    width: 94,
    height: 112,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: "#FFFFFF99",
  },
  balloonKnot: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  balloonString: { width: 2, height: 35, backgroundColor: "#947965" },
  popBurst: {
    position: "absolute",
    right: "17%",
    top: "23%",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 10,
    borderColor: "#F6B94D",
  },
  breathBubble: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 12,
    borderColor: "#7EC9BB",
    backgroundColor: "#CDEBE499",
  },
  promptCard: {
    minHeight: 82,
    width: "100%",
    maxWidth: 620,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 26,
    backgroundColor: "#FFFFFFE8",
    shadowColor: "#7B6149",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  promptText: {
    color: "#463A31",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 29,
    textAlign: "center",
  },
  speakingPulse: {
    width: 38,
    height: 5,
    marginTop: 9,
    borderRadius: 3,
    backgroundColor: "#2D8C7C",
  },
  choiceRow: {
    minHeight: 145,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingTop: 12,
  },
  visualChoice: {
    width: 142,
    height: 142,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 38,
    backgroundColor: "#FFFDF8",
    shadowColor: "#765C44",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  helpRow: {
    minHeight: 132,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 12,
  },
  helpChoice: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 32,
    backgroundColor: "#FFFDF8",
    shadowColor: "#765C44",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledChoice: { opacity: 0.48 },
  pressed: { transform: [{ scale: 0.92 }] },
  emotionChoiceContent: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
  },
  emotionSymbol: { fontSize: 72, lineHeight: 82 },
  heart: { color: "#EF6A73", fontSize: 76, lineHeight: 84 },
  breatheIcon: {
    width: 94,
    height: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  breatheFace: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    backgroundColor: "#F8D7A9",
  },
  closedEyesRow: { flexDirection: "row", gap: 13 },
  closedEye: {
    width: 13,
    height: 7,
    borderTopWidth: 3,
    borderTopColor: "#463A31",
    borderRadius: 7,
  },
  breatheMouth: {
    width: 9,
    height: 9,
    marginTop: 7,
    borderRadius: 5,
    backgroundColor: "#463A31",
  },
  breathLines: { width: 30, gap: 6, marginLeft: 3 },
  breathLineShort: {
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#55A9D6",
  },
  breathLineLong: {
    width: 28,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#55A9D6",
  },
  completedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF6E8",
  },
  completedPressed: { backgroundColor: "#F8ECD9" },
  completedCharacter: { width: "78%", height: "66%" },
  replayCircle: {
    width: 94,
    height: 94,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: 47,
    backgroundColor: "#2D8C7C",
  },
  replaySymbol: { color: "#FFFFFF", fontSize: 62, fontWeight: "900", lineHeight: 70 },
});
