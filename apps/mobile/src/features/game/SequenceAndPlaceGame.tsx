import type {
  RoutineItem,
  SequenceAndPlaceGame as SequenceAndPlaceGameContent,
} from "@adaptive/content-schema";
import * as Speech from "expo-speech";
import { createRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  type ImageSourcePropType,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { useGameObservation } from "./GameObservationContext";
import { isRoutineOrderCorrect, shuffledRoutineItems } from "./sequenceAndPlaceEngine";

const minoHappy = require("../../../assets/characters/mino-happy.png");
const starUnlit = require("../../../assets/game/routine/star-unlit-v1.png");
const starLit = require("../../../assets/game/routine/star-lit-v1.png");

const routineAssets: Record<RoutineItem["assetKey"], ImageSourcePropType> = {
  blocks: require("../../../assets/game/routine/blocks-v1.png"),
  "toy-basket": require("../../../assets/game/routine/toy-basket-v1.png"),
  toothbrush: require("../../../assets/game/routine/toothbrush-a-v1.png"),
  storybook: require("../../../assets/game/routine/storybook-b-v1.png"),
  pajamas: require("../../../assets/game/routine/pajamas-v1.png"),
  bed: require("../../../assets/game/routine/bed-v1.png"),
  "wash-hands": require("../../../assets/game/routine/wash-hands-a-v1.png"),
  towel: require("../../../assets/game/routine/towel-v1.png"),
  coat: require("../../../assets/game/routine/coat-v1.png"),
  shoes: require("../../../assets/game/routine/shoes-v1.png"),
};

type Bounds = { x: number; y: number; width: number; height: number };

function DraggableRoutineCard({
  item,
  enabled,
  highlighted,
  itemCount,
  slotBounds,
  onDrop,
  onTap,
}: {
  item: RoutineItem;
  enabled: boolean;
  highlighted: boolean;
  itemCount: number;
  slotBounds: Array<Bounds | null>;
  onDrop: (item: RoutineItem, slotIndex: number) => void;
  onTap: (item: RoutineItem) => void;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const densityStyle =
    itemCount >= 5
      ? styles.tinySourceCard
      : itemCount === 4
        ? styles.denseSourceCard
        : itemCount === 3
          ? styles.compactSourceCard
          : undefined;
  const imageDensityStyle =
    itemCount >= 5
      ? styles.tinySourceImage
      : itemCount === 4
        ? styles.denseSourceImage
        : itemCount === 3
          ? styles.compactSourceImage
          : undefined;
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) =>
      enabled && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
    onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gesture) => {
      const slotIndex = slotBounds.findIndex(
        (bounds) =>
          bounds &&
          gesture.moveX >= bounds.x - 18 &&
          gesture.moveX <= bounds.x + bounds.width + 18 &&
          gesture.moveY >= bounds.y - 18 &&
          gesture.moveY <= bounds.y + bounds.height + 18,
      );
      if (slotIndex >= 0) onDrop(item, slotIndex);
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  });
  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.sourceCard,
        densityStyle,
        highlighted && styles.highlightedCard,
        { transform: position.getTranslateTransform() },
      ]}
    >
      <Pressable
        accessibilityLabel={`${item.label}. Sürükle veya sıradaki boş alana yerleştirmek için dokun.`}
        disabled={!enabled}
        onPress={() => onTap(item)}
        style={styles.cardContent}
      >
        <Image
          source={routineAssets[item.assetKey]}
          style={[styles.sourceImage, imageDensityStyle]}
        />
        <Text numberOfLines={2} style={[styles.cardLabel, itemCount >= 4 && styles.denseCardLabel]}>
          {item.label}
        </Text>
        <Text style={[styles.dragLabel, itemCount >= 4 && styles.denseDragLabel]}>
          Sürükle veya dokun
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function SequenceAndPlaceGame({
  announceIntro = true,
  game,
  onExit,
  onRestart,
}: {
  announceIntro?: boolean;
  game: SequenceAndPlaceGameContent;
  onExit: () => void;
  onRestart: () => void;
}) {
  const report = useGameObservation();
  const [roundIndex, setRoundIndex] = useState(0);
  const initialStepCount = game.rounds[0]?.items.length ?? 2;
  const [placedIds, setPlacedIds] = useState<Array<string | null>>(
    Array(initialStepCount).fill(null),
  );
  const [slotBounds, setSlotBounds] = useState<Array<Bounds | null>>(
    Array(initialStepCount).fill(null),
  );
  const [feedback, setFeedback] = useState("");
  const [locked, setLocked] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const slotRefs = useRef(Array.from({ length: 25 }, () => createRef<View>())).current;
  const currentRound = game.rounds[roundIndex];
  const itemCount = currentRound.items.length;
  const sourceDensityStyle =
    itemCount >= 5
      ? styles.tinySourceCard
      : itemCount === 4
        ? styles.denseSourceCard
        : itemCount === 3
          ? styles.compactSourceCard
          : undefined;
  const slotDensityStyle =
    itemCount >= 5
      ? styles.tinySlot
      : itemCount === 4
        ? styles.denseSlot
        : itemCount === 3
          ? styles.compactSlot
          : undefined;
  const displayedItems = useMemo(
    () => shuffledRoutineItems(currentRound.items, roundIndex),
    [currentRound.items, roundIndex],
  );

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (!game.presentation.playAudioInstructions) return onDone?.();
      void Speech.stop().then(() =>
        Speech.speak(text, { language: "tr-TR", rate: 0.84, onDone, onStopped: onDone }),
      );
    },
    [game.presentation.playAudioInstructions],
  );

  useEffect(() => {
    setPlacedIds(Array(currentRound.items.length).fill(null));
    setSlotBounds(Array(currentRound.items.length).fill(null));
    setHighlightedId(null);
    setFeedback(roundIndex === 0 ? "" : "Yeni rutin geliyor!");
    setLocked(true);
    const intro =
      roundIndex === 0 && announceIntro
        ? game.presentation.introNarration
        : currentRound.instruction;
    speak(intro, () => {
      if (roundIndex === 0 && announceIntro)
        speak(currentRound.instruction, () => setLocked(false));
      else setLocked(false);
    });
    return () => {
      void Speech.stop();
    };
  }, [announceIntro, currentRound, game.presentation.introNarration, roundIndex, speak]);

  useEffect(() => {
    if (locked || completed) return;
    const timeout = setTimeout(() => {
      report({ type: "help", stepId: currentRound.id });
      report({ type: "wait", stepId: currentRound.id, waitMs: game.difficulty.hintDelayMs });
      const nextCorrectId = currentRound.correctOrder.find((id) => !placedIds.includes(id));
      setHighlightedId(nextCorrectId ?? null);
      setFeedback(game.feedback.hint);
      speak(game.feedback.hint);
    }, game.difficulty.hintDelayMs);
    return () => clearTimeout(timeout);
  }, [
    completed,
    currentRound,
    game.difficulty.hintDelayMs,
    game.feedback.hint,
    locked,
    placedIds,
    speak,
  ]);

  const finishRound = (orderedIds: string[]) => {
    const correct = isRoutineOrderCorrect(currentRound, orderedIds);
    report({ type: "attempt", stepId: currentRound.id, correct });
    if (!correct) {
      report({ type: "retry", stepId: currentRound.id });
      Vibration.vibrate(20);
      setLocked(true);
      setFeedback(game.feedback.retry);
      speak(game.feedback.retry, () => {
        setAttempt((value) => value + 1);
        setPlacedIds(Array(currentRound.items.length).fill(null));
        setHighlightedId(currentRound.correctOrder[0] ?? null);
        setLocked(false);
      });
      return;
    }
    Vibration.vibrate(35);
    setLocked(true);
    setFeedback(game.feedback.matched);
    speak(game.feedback.matched, () => {
      if (roundIndex === game.rounds.length - 1) {
        report({ type: "completed", stepId: currentRound.id });
        setCompleted(true);
        speak(game.presentation.closingNarration);
      } else {
        setAttempt(0);
        setRoundIndex((value) => value + 1);
      }
    });
  };

  const placeItem = (item: RoutineItem, slotIndex: number) => {
    if (locked || placedIds.includes(item.id)) return;
    const next = [...placedIds];
    const previousSlot = next.findIndex((id) => id === item.id);
    if (previousSlot >= 0) next[previousSlot] = null;
    next[slotIndex] = item.id;
    setPlacedIds(next);
    setHighlightedId(null);
    if (next.every(Boolean)) finishRound(next as string[]);
  };

  if (completed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.completedCard}>
          <View style={[styles.starPath, game.rounds.length > 6 && styles.longStarPath]}>
            {game.rounds.map((round) => (
              <Image
                key={round.id}
                source={starLit}
                style={[styles.bigStar, game.rounds.length > 6 && styles.completedSmallStar]}
              />
            ))}
          </View>
          <Image source={minoHappy} style={styles.completedMascot} />
          <Text style={styles.completedTitle}>Rutin yolu tamamlandı!</Text>
          <Text style={styles.completedCopy}>{game.presentation.closingNarration}</Text>
          <Pressable onPress={onRestart} style={styles.exitButton}>
            <Text style={styles.exitText}>Tekrar başlamak için dokun</Text>
          </Pressable>
          <Pressable onPress={onExit}>
            <Text style={styles.completedCopy}>Oyunlara dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
      <View style={styles.gameArea}>
        <View style={[styles.starPath, game.rounds.length > 6 && styles.longStarPath]}>
          {game.rounds.map((round, index) => (
            <Image
              key={round.id}
              source={index < roundIndex ? starLit : starUnlit}
              style={[styles.star, game.rounds.length > 6 && styles.smallStar]}
            />
          ))}
        </View>
        <Image source={minoHappy} style={styles.mascot} />
        <Text style={styles.title}>{game.title}</Text>
        <Text style={styles.instruction}>{currentRound.instruction}</Text>
        <View style={[styles.sourceRow, itemCount >= 4 && styles.denseRow]}>
          {displayedItems.map((item) =>
            placedIds.includes(item.id) ? (
              <View key={item.id} style={[styles.sourcePlaceholder, sourceDensityStyle]} />
            ) : (
              <DraggableRoutineCard
                enabled={!locked}
                highlighted={highlightedId === item.id}
                item={item}
                itemCount={itemCount}
                key={item.id}
                onDrop={placeItem}
                onTap={(selectedItem) => {
                  const firstEmptySlot = placedIds.findIndex((id) => id === null);
                  if (firstEmptySlot >= 0) placeItem(selectedItem, firstEmptySlot);
                }}
                slotBounds={slotBounds}
              />
            ),
          )}
        </View>
        <View style={[styles.slotRow, itemCount >= 4 && styles.denseRow]}>
          {placedIds.map((itemId, index) => {
            const item = currentRound.items.find((candidate) => candidate.id === itemId);
            return (
              <Pressable
                accessibilityLabel={`${index + 1}. adım alanı`}
                key={`slot-${index}`}
                onLayout={() =>
                  slotRefs[index]?.current?.measureInWindow((x, y, width, height) => {
                    setSlotBounds((current) =>
                      current.map((bounds, boundsIndex) =>
                        boundsIndex === index ? { x, y, width, height } : bounds,
                      ),
                    );
                  })
                }
                onPress={() =>
                  item &&
                  !locked &&
                  setPlacedIds((current) =>
                    current.map((id, itemIndex) => (itemIndex === index ? null : id)),
                  )
                }
                ref={slotRefs[index]}
                style={[styles.slot, slotDensityStyle]}
              >
                <Text style={[styles.slotLabel, itemCount >= 3 && styles.compactSlotLabel]}>
                  {index === 0
                    ? "1 · ÖNCE"
                    : index === itemCount - 1
                      ? `${index + 1} · EN SON`
                      : `${index + 1} · SONRA`}
                </Text>
                {item ? (
                  <Image
                    source={routineAssets[item.assetKey]}
                    style={[
                      styles.slotImage,
                      itemCount >= 5
                        ? styles.tinySlotImage
                        : itemCount === 4
                          ? styles.denseSlotImage
                          : itemCount === 3
                            ? styles.compactSlotImage
                            : undefined,
                    ]}
                  />
                ) : (
                  <Text style={styles.slotArrow}>↓</Text>
                )}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.feedback}>{locked && !feedback ? "Tomo anlatıyor…" : feedback}</Text>
        <Text style={styles.attemptText}>{attempt > 0 ? "Birlikte yeniden deniyoruz" : ""}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#172948", paddingHorizontal: 18 },
  closeButton: {
    position: "absolute",
    zIndex: 3,
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
  gameArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 16 },
  starPath: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  longStarPath: { maxWidth: 340, flexWrap: "wrap", rowGap: 0 },
  star: { width: 48, height: 48, resizeMode: "contain" },
  smallStar: { width: 28, height: 28 },
  bigStar: { width: 70, height: 70, resizeMode: "contain" },
  completedSmallStar: { width: 42, height: 42 },
  mascot: { width: 76, height: 76, resizeMode: "contain" },
  title: { color: "#FFF8E8", fontSize: 27, fontWeight: "900" },
  instruction: {
    minHeight: 64,
    maxWidth: 350,
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 26,
    textAlign: "center",
  },
  sourceRow: {
    width: "100%",
    maxWidth: 334,
    minHeight: 150,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 8,
  },
  denseRow: { minHeight: 96, gap: 6 },
  sourceCard: {
    zIndex: 5,
    width: 145,
    height: 145,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 25,
    backgroundColor: "#FDF7E9",
  },
  cardContent: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  compactSourceCard: { width: 104, height: 116, borderRadius: 20 },
  denseSourceCard: { width: 78, height: 96, borderRadius: 17 },
  tinySourceCard: { width: 52, height: 48, borderRadius: 12, borderWidth: 2 },
  sourcePlaceholder: { width: 145, height: 145 },
  highlightedCard: { borderWidth: 6, borderColor: "#FFD95A", backgroundColor: "#FFF3B3" },
  sourceImage: { width: 100, height: 94, resizeMode: "contain" },
  compactSourceImage: { width: 72, height: 70 },
  denseSourceImage: { width: 54, height: 52 },
  tinySourceImage: { width: 32, height: 28 },
  cardLabel: { color: "#4F443C", fontSize: 13, fontWeight: "900" },
  denseCardLabel: { maxWidth: 58, fontSize: 9, lineHeight: 10, textAlign: "center" },
  dragLabel: { color: "#83776E", fontSize: 10, fontWeight: "700" },
  denseDragLabel: { fontSize: 7 },
  slotRow: {
    width: "100%",
    maxWidth: 334,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  slot: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderStyle: "dashed",
    borderColor: "#A7C7E8",
    borderRadius: 28,
    backgroundColor: "#243C63",
  },
  compactSlot: { width: 104, height: 124, borderRadius: 22 },
  denseSlot: { width: 78, height: 104, borderRadius: 18, borderWidth: 3 },
  tinySlot: { width: 52, height: 54, borderRadius: 12, borderWidth: 2 },
  slotLabel: { position: "absolute", top: 9, color: "#FFD95A", fontSize: 14, fontWeight: "900" },
  compactSlotLabel: { fontSize: 11 },
  slotImage: { width: 110, height: 110, marginTop: 20, resizeMode: "contain" },
  compactSlotImage: { width: 78, height: 78 },
  denseSlotImage: { width: 56, height: 56 },
  tinySlotImage: { width: 30, height: 28 },
  slotArrow: { color: "#A7C7E8", fontSize: 42, fontWeight: "900" },
  feedback: {
    minHeight: 44,
    maxWidth: 340,
    marginTop: 12,
    color: "#FFF8E8",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  attemptText: { minHeight: 20, color: "#B9CBE0", fontSize: 12 },
  completedCard: { flex: 1, alignItems: "center", justifyContent: "center" },
  completedMascot: { width: 160, height: 160, resizeMode: "contain" },
  completedTitle: { color: "#FFF8E8", fontSize: 30, fontWeight: "900", textAlign: "center" },
  completedCopy: {
    maxWidth: 320,
    marginTop: 8,
    color: "#DDE9F6",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  exitButton: {
    marginTop: 24,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#F2A74B",
  },
  exitText: { color: "#3B2E24", fontSize: 17, fontWeight: "900" },
});
