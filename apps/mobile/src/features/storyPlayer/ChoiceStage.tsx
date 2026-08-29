import type { PublishedPlaybackClip } from "@adaptive/media-schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createAudioOwner } from "./audioOwner";
import { getChoiceVisual } from "./choiceVisual";

type DecisionClip = Extract<PublishedPlaybackClip, { kind: "decision" }>;

function playAndWait(owner: ReturnType<typeof createAudioOwner>, uri: string): Promise<void> {
  return new Promise((resolve) => owner.play(uri, resolve));
}

export function ChoiceStage({
  clip,
  onSelect,
  onError,
  resolvePublishedMediaRef,
}: {
  clip: DecisionClip;
  onSelect: (optionId: string) => void;
  onError: (detail: string) => void;
  resolvePublishedMediaRef: (mediaRef: string) => Promise<string>;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [questionFinished, setQuestionFinished] = useState(false);
  const audioOwnerRef = useRef(createAudioOwner());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    setSelectedOptionId(null);
    setQuestionFinished(false);
    const owner = audioOwnerRef.current;
    let cancelled = false;

    async function narrateQuestion() {
      try {
        const questionUri = await resolvePublishedMediaRef(clip.question.audio.mediaRef);
        if (cancelled) return;
        await playAndWait(owner, questionUri);
        if (!cancelled) setQuestionFinished(true);
      } catch (error) {
        if (!cancelled) {
          onErrorRef.current(
            error instanceof Error
              ? error.message
              : `Failed to play question audio for clip "${clip.id}"`,
          );
        }
      }
    }

    void narrateQuestion();
    return () => {
      cancelled = true;
      owner.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by clip.id at the call site
  }, [clip.id]);

  async function handleSelect(optionId: string) {
    if (selectedOptionId || !questionFinished) return;
    const owner = audioOwnerRef.current;
    const option = clip.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      onErrorRef.current(`Unknown choice "${optionId}" for clip "${clip.id}"`);
      return;
    }
    setSelectedOptionId(optionId);
    // Play the selected option's own reinforcement narration first (no
    // correct/wrong framing -- both options carry positive feedback), then
    // advance once it finishes. If it fails to resolve/play, report the
    // failure instead of silently skipping the reinforcement.
    try {
      const optionUri = await resolvePublishedMediaRef(option.audio.mediaRef);
      await playAndWait(owner, optionUri);
      onSelect(optionId);
    } catch (error) {
      onErrorRef.current(
        error instanceof Error
          ? error.message
          : `Failed to play choice audio for clip "${clip.id}"`,
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{clip.question.text}</Text>
        {!questionFinished && !selectedOptionId ? (
          <Text style={styles.listeningText}>Soruyu dinliyoruz…</Text>
        ) : null}
        {selectedOptionId ? <Text style={styles.listeningText}>Harika, dinliyoruz…</Text> : null}
      </View>
      <View style={styles.optionsRow}>
        {clip.options.map((option) => {
          const visual = getChoiceVisual(option.id, option.label);
          const selected = selectedOptionId === option.id;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{
                disabled: Boolean(selectedOptionId) || !questionFinished,
                selected,
              }}
              disabled={Boolean(selectedOptionId) || !questionFinished}
              key={option.id}
              onPress={() => handleSelect(option.id)}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: visual.backgroundColor,
                  borderColor: visual.borderColor,
                },
                selected && styles.optionCardSelected,
                pressed && styles.optionCardPressed,
              ]}
            >
              <View style={styles.optionIconCircle}>
                <MaterialCommunityIcons
                  accessibilityElementsHidden
                  color={visual.iconColor}
                  importantForAccessibility="no"
                  name={visual.icon}
                  size={82}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF6E8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 24,
  },
  questionCard: {
    width: "100%",
    padding: 22,
    borderRadius: 26,
    backgroundColor: "#EAF5F2",
  },
  questionText: { color: "#463A31", fontSize: 22, fontWeight: "900", textAlign: "center" },
  listeningText: {
    color: "#397F78",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  optionsRow: { width: "100%", flexDirection: "row", gap: 16 },
  optionCard: {
    flex: 1,
    aspectRatio: 1,
    minHeight: 144,
    borderWidth: 4,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  optionCardSelected: {
    borderWidth: 7,
    transform: [{ scale: 0.96 }],
  },
  optionCardPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  optionIconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
});
