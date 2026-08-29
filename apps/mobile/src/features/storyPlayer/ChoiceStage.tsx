import type { PublishedPlaybackClip } from "@adaptive/media-schema";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createAudioOwner } from "./audioOwner";

type DecisionClip = Extract<PublishedPlaybackClip, { kind: "decision" }>;

function playAndWait(
  owner: ReturnType<typeof createAudioOwner>,
  uri: string,
): Promise<void> {
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
  const audioOwnerRef = useRef(createAudioOwner());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    setSelectedOptionId(null);
    const owner = audioOwnerRef.current;
    let cancelled = false;

    async function narrate() {
      try {
        const questionUri = await resolvePublishedMediaRef(clip.question.audio.mediaRef);
        if (cancelled) return;
        await playAndWait(owner, questionUri);
        for (const option of clip.options) {
          if (cancelled) return;
          const optionUri = await resolvePublishedMediaRef(option.audio.mediaRef);
          if (cancelled) return;
          await playAndWait(owner, optionUri);
        }
      } catch (error) {
        if (!cancelled) {
          onErrorRef.current(
            error instanceof Error ? error.message : `Failed to play choice audio for clip "${clip.id}"`,
          );
        }
      }
    }

    void narrate();
    return () => {
      cancelled = true;
      owner.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by clip.id at the call site
  }, [clip.id]);

  function handleSelect(optionId: string) {
    if (selectedOptionId) return; // local guard: a card is already chosen, ignore further taps
    setSelectedOptionId(optionId);
    audioOwnerRef.current.release();
    onSelect(optionId);
  }

  return (
    <View style={styles.container}>
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{clip.question.text}</Text>
      </View>
      <View style={styles.optionsRow}>
        {clip.options.map((option, index) => (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="button"
            disabled={Boolean(selectedOptionId)}
            key={option.id}
            onPress={() => handleSelect(option.id)}
            style={({ pressed }) => [
              styles.optionCard,
              index === 1 && styles.optionCardAlternate,
              pressed && styles.optionCardPressed,
            ]}
          >
            <Text style={styles.optionLabel}>{option.label}</Text>
          </Pressable>
        ))}
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
  optionsRow: { width: "100%", gap: 16 },
  optionCard: {
    minHeight: 96,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 24,
    backgroundColor: "#FFD9C8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  optionCardAlternate: { backgroundColor: "#CDEBE4" },
  optionCardPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  optionLabel: { color: "#463A31", fontSize: 22, fontWeight: "900", textAlign: "center" },
});
