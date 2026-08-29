import type {
  MomoCableEndpoint,
  MomoPartVisual,
  MomoShape,
  MomoWorkshopGame as MomoWorkshopGameContent,
} from "@adaptive/content-schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { loadMomoCustomization, saveMomoCustomization } from "../../services/momoCustomization";
import { useGameObservation } from "./GameObservationContext";
import {
  type Bounds,
  cableEndpointsMatch,
  crystalCountMatches,
  findCableDropTarget,
  outcomeForGuidedAttempt,
  patternShapeMatches,
} from "./momoWorkshopEngine";

const cableColors = {
  coral: "#F37970",
  blue: "#4B8FE8",
  yellow: "#F3BF3D",
} as const;

const shapeColors: Record<MomoShape, string> = {
  circle: "#F37970",
  square: "#4B8FE8",
  triangle: "#F3BF3D",
};

function MomoAvatar({
  selectedPart,
  large = false,
  dancing = false,
}: {
  selectedPart: MomoPartVisual | null;
  large?: boolean;
  dancing?: boolean;
}) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!dancing) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -10,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 280,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 6 },
    );
    animation.start();
    return () => animation.stop();
  }, [bounce, dancing]);

  const size = large ? 190 : 92;
  return (
    <Animated.View
      accessibilityLabel="Gülümseyen robot Momo"
      accessible
      style={[styles.momo, { width: size, height: size, transform: [{ translateY: bounce }] }]}
    >
      <View style={[styles.momoAntennaStem, large && styles.momoAntennaStemLarge]} />
      <View style={[styles.momoAntennaTop, large && styles.momoAntennaTopLarge]}>
        {selectedPart === "star-antenna" ? (
          <MaterialCommunityIcons color="#F4B83C" name="star-four-points" size={large ? 44 : 27} />
        ) : selectedPart === "spring-antenna" ? (
          <MaterialCommunityIcons color="#EF776C" name="heart" size={large ? 40 : 25} />
        ) : (
          <View style={[styles.momoAntennaDot, large && styles.momoAntennaDotLarge]} />
        )}
      </View>
      <View style={[styles.momoEar, styles.momoEarLeft]} />
      <View style={[styles.momoEar, styles.momoEarRight]} />
      <View style={styles.momoFace}>
        <View style={styles.momoEyes}>
          <View style={styles.momoEye} />
          <View style={styles.momoEye} />
        </View>
        <View style={styles.momoSmile} />
      </View>
      <View style={styles.momoGlow} />
    </Animated.View>
  );
}

function ShapeArt({ shape, size = 58 }: { shape: MomoShape; size?: number }) {
  if (shape === "triangle") {
    return (
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderBottomWidth: size,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: shapeColors[shape],
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: shape === "circle" ? size / 2 : 12,
        backgroundColor: shapeColors[shape],
      }}
    />
  );
}

function CableEnd({
  endpoint,
  enabled,
  connected,
  highlighted,
  onBounds,
  onDrop,
}: {
  endpoint: MomoCableEndpoint;
  enabled: boolean;
  connected: boolean;
  highlighted: boolean;
  onBounds: (id: string, bounds: Bounds) => void;
  onDrop: (id: string, point: { x: number; y: number }) => void;
}) {
  const viewRef = useRef<View>(null);
  const position = useRef(new Animated.ValueXY()).current;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          enabled && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          onDrop(endpoint.id, { x: gesture.moveX, y: gesture.moveY });
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start(),
      }),
    [enabled, endpoint.id, onDrop, position],
  );

  const measure = () =>
    viewRef.current?.measureInWindow((x, y, width, height) =>
      onBounds(endpoint.id, { x, y, width, height }),
    );

  return (
    <Animated.View
      ref={viewRef}
      onLayout={measure}
      {...responder.panHandlers}
      style={[
        styles.cableEnd,
        endpoint.side === "left" ? styles.cableEndLeft : styles.cableEndRight,
        connected && styles.cableConnected,
        highlighted && styles.highlighted,
        { transform: position.getTranslateTransform() },
      ]}
    >
      <View style={[styles.cableLine, { backgroundColor: cableColors[endpoint.color] }]} />
      <View
        style={[
          styles.cablePlug,
          { backgroundColor: cableColors[endpoint.color] },
          connected && styles.cablePlugConnected,
        ]}
      >
        <MaterialCommunityIcons
          color="#FFFFFF"
          name={connected ? "check-bold" : "drag"}
          size={23}
        />
      </View>
    </Animated.View>
  );
}

function CableMatchRound({
  endpoints,
  locked,
  reveal,
  onAttempt,
  onComplete,
}: {
  endpoints: MomoCableEndpoint[];
  locked: boolean;
  reveal: boolean;
  onAttempt: (correct: boolean) => void;
  onComplete: () => void;
}) {
  const [bounds, setBounds] = useState<Record<string, Bounds>>({});
  const [connectedKeys, setConnectedKeys] = useState<string[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const left = useMemo(() => endpoints.filter((endpoint) => endpoint.side === "left"), [endpoints]);
  const right = useMemo(
    () => endpoints.filter((endpoint) => endpoint.side === "right").reverse(),
    [endpoints],
  );
  const allKeys = useMemo(
    () => [...new Set(endpoints.map((endpoint) => endpoint.matchKey))],
    [endpoints],
  );

  useEffect(() => {
    if (!reveal) return;
    setConnectedKeys(allKeys);
  }, [allKeys, reveal]);

  const drop = useCallback(
    (sourceId: string, point: { x: number; y: number }) => {
      if (locked) return;
      const source = endpoints.find((endpoint) => endpoint.id === sourceId);
      if (!source) return;
      const targetId = findCableDropTarget(
        point,
        sourceId,
        endpoints
          .filter((endpoint) => endpoint.side !== source.side)
          .flatMap((endpoint) =>
            bounds[endpoint.id]
              ? [
                  {
                    id: endpoint.id,
                    bounds: bounds[endpoint.id],
                    connected: connectedKeys.includes(endpoint.matchKey),
                  },
                ]
              : [],
          ),
        24,
      );
      const target = endpoints.find((endpoint) => endpoint.id === targetId);
      const correct = Boolean(target && cableEndpointsMatch(source, target));
      onAttempt(correct);
      if (!correct) {
        const expected = endpoints.find(
          (endpoint) => endpoint.side !== source.side && endpoint.matchKey === source.matchKey,
        );
        setHighlightedId(expected?.id ?? null);
        return;
      }
      Vibration.vibrate(28);
      setHighlightedId(null);
      const next = [...connectedKeys, source.matchKey];
      setConnectedKeys(next);
      if (next.length === allKeys.length) setTimeout(onComplete, 500);
    },
    [allKeys.length, bounds, connectedKeys, endpoints, locked, onAttempt, onComplete],
  );

  return (
    <View style={styles.cableBoard}>
      <View style={styles.cableColumn}>
        {left.map((endpoint) => (
          <CableEnd
            connected={connectedKeys.includes(endpoint.matchKey)}
            enabled={!locked && !connectedKeys.includes(endpoint.matchKey)}
            endpoint={endpoint}
            highlighted={highlightedId === endpoint.id}
            key={endpoint.id}
            onBounds={(id, endpointBounds) =>
              setBounds((current) => ({ ...current, [id]: endpointBounds }))
            }
            onDrop={drop}
          />
        ))}
      </View>
      <View style={styles.powerCore}>
        <MaterialCommunityIcons
          color={connectedKeys.length === allKeys.length ? "#F7C948" : "#9AB4C8"}
          name="lightning-bolt"
          size={52}
        />
      </View>
      <View style={styles.cableColumn}>
        {right.map((endpoint) => (
          <CableEnd
            connected={connectedKeys.includes(endpoint.matchKey)}
            enabled={!locked && !connectedKeys.includes(endpoint.matchKey)}
            endpoint={endpoint}
            highlighted={highlightedId === endpoint.id}
            key={endpoint.id}
            onBounds={(id, endpointBounds) =>
              setBounds((current) => ({ ...current, [id]: endpointBounds }))
            }
            onDrop={drop}
          />
        ))}
      </View>
    </View>
  );
}

function CrystalCountRound({
  crystalCount,
  targetCount,
  locked,
  reveal,
  onSubmit,
}: {
  crystalCount: number;
  targetCount: number;
  locked: boolean;
  reveal: boolean;
  onSubmit: (selectedCount: number) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => {
    if (reveal) setSelected(Array.from({ length: targetCount }, (_, index) => index));
  }, [reveal, targetCount]);
  const toggle = (index: number) =>
    setSelected((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  return (
    <View style={styles.crystalRound}>
      <View style={styles.crystalShelf}>
        {Array.from({ length: crystalCount }, (_, index) => (
          <Pressable
            accessibilityLabel={`${index + 1}. enerji kristali`}
            disabled={locked}
            key={`crystal-${index}`}
            onPress={() => toggle(index)}
            style={[styles.crystalButton, selected.includes(index) && styles.crystalSelected]}
          >
            <MaterialCommunityIcons
              color={selected.includes(index) ? "#B8C7D4" : "#7B67D9"}
              name="diamond-stone"
              size={54}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.energyBasket}>
        <MaterialCommunityIcons color="#F3BF3D" name="battery-charging" size={52} />
        <Text style={styles.energyCount}>{selected.length}</Text>
        <Pressable
          accessibilityLabel="Kristal sayısını onayla"
          disabled={locked}
          onPress={() => onSubmit(selected.length)}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons color="#FFFFFF" name="check-bold" size={30} />
        </Pressable>
      </View>
    </View>
  );
}

function PatternShapeRound({
  sequence,
  choices,
  correctShape,
  locked,
  reveal,
  onChoose,
}: {
  sequence: MomoShape[];
  choices: MomoShape[];
  correctShape: MomoShape;
  locked: boolean;
  reveal: boolean;
  onChoose: (shape: MomoShape) => void;
}) {
  return (
    <View style={styles.patternRound}>
      <View style={styles.patternSequence}>
        {sequence.map((shape, index) => (
          <View key={`${shape}-${index}`} style={styles.patternTile}>
            <ShapeArt shape={shape} size={44} />
          </View>
        ))}
        <View style={[styles.patternTile, styles.missingTile]}>
          <Text style={styles.questionMark}>?</Text>
        </View>
      </View>
      <View style={styles.shapeChoices}>
        {choices.map((shape) => (
          <Pressable
            accessibilityLabel={`${shape} şeklini seç`}
            disabled={locked}
            key={shape}
            onPress={() => onChoose(shape)}
            style={({ pressed }) => [
              styles.shapeChoice,
              reveal && shape === correctShape && styles.highlighted,
              pressed && styles.pressed,
            ]}
          >
            <ShapeArt shape={shape} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RewardChoice({
  visual,
  label,
  onPress,
}: {
  visual: MomoPartVisual;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} parçasını seç`}
      onPress={onPress}
      style={({ pressed }) => [styles.rewardCard, pressed && styles.rewardCardPressed]}
    >
      <MomoAvatar selectedPart={visual} />
      <Text style={styles.rewardLabel}>{label}</Text>
      <View style={styles.choosePill}>
        <MaterialCommunityIcons color="#FFFFFF" name="hand-pointing-up" size={24} />
      </View>
    </Pressable>
  );
}

export function MomoWorkshopGame({
  childId,
  childName,
  game,
  onExit,
}: {
  childId: string;
  childName: string;
  game: MomoWorkshopGameContent;
  onExit: () => void;
}) {
  const report = useGameObservation();
  const [roundIndex, setRoundIndex] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [locked, setLocked] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<"rounds" | "reward" | "complete">("rounds");
  const [selectedPart, setSelectedPart] = useState<MomoPartVisual | null>(null);
  const feedbackShake = useRef(new Animated.Value(0)).current;
  const round = game.rounds[roundIndex];

  const speak = useCallback(
    (text: string, done?: () => void) => {
      if (!game.presentation.playAudioInstructions) return done?.();
      void Speech.stop();
      Speech.speak(text, { language: "tr-TR", rate: 0.84, onDone: done, onStopped: done });
    },
    [game.presentation.playAudioInstructions],
  );

  useEffect(() => {
    void loadMomoCustomization(childId)
      .then(setSelectedPart)
      .catch(() => undefined);
  }, [childId]);

  useEffect(() => {
    if (phase !== "rounds") return;
    setWrongAttempts(0);
    setFeedback("");
    setRevealed(false);
    setLocked(true);
    const unlockWithPrompt = () => speak(round.prompt, () => setLocked(false));
    if (roundIndex === 0) speak(game.presentation.introNarration, unlockWithPrompt);
    else unlockWithPrompt();
    return () => void Speech.stop();
  }, [game.presentation.introNarration, phase, round, roundIndex, speak]);

  useEffect(() => {
    if (phase !== "reward") return;
    setLocked(true);
    setFeedback("");
    speak(game.presentation.rewardNarration, () => setLocked(false));
  }, [game.presentation.rewardNarration, phase, speak]);

  const finishRound = useCallback(() => {
    setLocked(true);
    setFeedback(game.feedback.matched);
    Vibration.vibrate(35);
    speak(game.feedback.matched, () => {
      if (roundIndex === game.rounds.length - 1) setPhase("reward");
      else setRoundIndex((current) => current + 1);
    });
  }, [game.feedback.matched, game.rounds.length, roundIndex, speak]);

  const handleAttempt = useCallback(
    (correct: boolean) => {
      if (locked) return;
      report({ type: "attempt", stepId: round.id, correct });
      const outcome = outcomeForGuidedAttempt(
        correct,
        wrongAttempts,
        game.difficulty.secondTryEnabled,
      );
      if (outcome === "matched") {
        finishRound();
        return;
      }
      if (outcome === "retry") {
        setWrongAttempts(1);
        setFeedback(game.feedback.retry);
        report({ type: "retry", stepId: round.id });
        Vibration.vibrate(18);
        Animated.sequence([
          Animated.timing(feedbackShake, { toValue: -7, duration: 75, useNativeDriver: true }),
          Animated.timing(feedbackShake, { toValue: 7, duration: 100, useNativeDriver: true }),
          Animated.spring(feedbackShake, { toValue: 0, useNativeDriver: true }),
        ]).start();
        speak(game.feedback.retry);
        return;
      }
      setLocked(true);
      setRevealed(true);
      setFeedback(game.feedback.reveal);
      report({ type: "help", stepId: round.id });
      speak(game.feedback.reveal, () => setTimeout(finishRound, 900));
    },
    [
      finishRound,
      feedbackShake,
      game.difficulty.secondTryEnabled,
      game.feedback.retry,
      game.feedback.reveal,
      locked,
      report,
      round.id,
      speak,
      wrongAttempts,
    ],
  );

  useEffect(() => {
    if (phase !== "rounds" || locked) return;
    const timeout = setTimeout(() => {
      report({ type: "wait", stepId: round.id, waitMs: game.difficulty.inactivityHintMs });
      setLocked(true);
      setRevealed(true);
      setFeedback(game.feedback.reveal);
      speak(game.feedback.reveal, () => setTimeout(finishRound, 1_100));
    }, game.difficulty.inactivityHintMs);
    return () => clearTimeout(timeout);
  }, [
    finishRound,
    game.difficulty.inactivityHintMs,
    game.feedback.reveal,
    locked,
    phase,
    report,
    round.id,
    speak,
  ]);

  const selectReward = (part: MomoPartVisual, stepId: string) => {
    if (locked) return;
    setLocked(true);
    setSelectedPart(part);
    report({ type: "attempt", stepId, correct: true });
    void saveMomoCustomization(childId, part).catch(() => undefined);
    const closing = game.presentation.closingNarration.replace("{childName}", childName);
    speak(closing, () => {
      report({ type: "completed", stepId });
      setPhase("complete");
    });
  };

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.sparkleOne} />
        <View style={styles.sparkleTwo} />
        <View style={styles.finishCard}>
          <Text style={styles.finishEyebrow}>ATÖLYE IŞIL IŞIL!</Text>
          <MomoAvatar dancing large selectedPart={selectedPart} />
          <Text style={styles.finishTitle}>Momo uyandı!</Text>
          <Text style={styles.finishCopy}>
            {game.presentation.closingNarration.replace("{childName}", childName)}
          </Text>
          <Pressable accessibilityRole="button" onPress={onExit} style={styles.exitButton}>
            <Text style={styles.exitButtonText}>Oyunlara dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "reward") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          accessibilityLabel="Oyundan çık"
          hitSlop={10}
          onPress={onExit}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={styles.rewardScreen}>
          <Text style={styles.stepEyebrow}>SON DOKUNUŞ</Text>
          <Text style={styles.rewardTitle}>Momo’nun parçasını seç</Text>
          <View style={styles.rewardChoices}>
            {game.rewardChoices.map((choice) => (
              <RewardChoice
                key={choice.id}
                label={choice.label}
                onPress={() => selectReward(choice.visual, choice.id)}
                visual={choice.visual}
              />
            ))}
          </View>
          <Text style={styles.feedback}>{locked ? "Momo anlatıyor…" : "Seçim senin!"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.workshopBackdrop}>
        <View style={styles.backdropCircleOne} />
        <View style={styles.backdropCircleTwo} />
      </View>
      <Pressable
        accessibilityLabel="Oyundan çık"
        hitSlop={10}
        onPress={onExit}
        style={styles.close}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <View style={styles.progressRow}>
        {Array.from({ length: 5 }, (_, index) => (
          <View
            key={`step-${index}`}
            style={[styles.progressDot, index <= roundIndex && styles.progressDotOn]}
          />
        ))}
      </View>
      <View style={styles.gameHeader}>
        <MomoAvatar selectedPart={selectedPart} />
        <View style={styles.headerCopy}>
          <Text style={styles.stepEyebrow}>MOMO’YU UYANDIR · {roundIndex + 1}/3</Text>
          <Text style={styles.gameTitle}>{game.title}</Text>
        </View>
        <Pressable
          accessibilityLabel="Yönergeyi yeniden dinle"
          disabled={locked}
          onPress={() => speak(round.prompt)}
          style={styles.listenButton}
        >
          <MaterialCommunityIcons color="#3C6E92" name="volume-high" size={28} />
        </Pressable>
      </View>
      <View style={styles.instructionCard}>
        <Text style={styles.instruction}>{round.prompt}</Text>
      </View>
      <View style={styles.roundArea}>
        {round.kind === "cable_match" ? (
          <CableMatchRound
            endpoints={round.endpoints}
            locked={locked}
            onAttempt={(correct) => {
              if (correct) report({ type: "attempt", stepId: round.id, correct: true });
              else handleAttempt(false);
            }}
            onComplete={finishRound}
            reveal={revealed}
          />
        ) : round.kind === "crystal_count" ? (
          <CrystalCountRound
            crystalCount={round.crystalCount}
            key={round.id}
            locked={locked}
            onSubmit={(count) => handleAttempt(crystalCountMatches(count, round.targetCount))}
            reveal={revealed}
            targetCount={round.targetCount}
          />
        ) : (
          <PatternShapeRound
            choices={round.choices}
            correctShape={round.correctShape}
            locked={locked}
            onChoose={(shape) => handleAttempt(patternShapeMatches(shape, round.correctShape))}
            reveal={revealed}
            sequence={round.sequence}
          />
        )}
      </View>
      <Animated.Text style={[styles.feedback, { transform: [{ translateX: feedbackShake }] }]}>
        {locked && !feedback ? "Momo anlatıyor…" : feedback}
      </Animated.Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, overflow: "hidden", backgroundColor: "#EEF8FB", paddingHorizontal: 18 },
  workshopBackdrop: { ...StyleSheet.absoluteFillObject },
  backdropCircleOne: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#D8F0EE",
  },
  backdropCircleTwo: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#E9E1FB",
  },
  close: {
    position: "absolute",
    zIndex: 10,
    top: 12,
    left: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E96F67",
    shadowColor: "#7B4140",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  closeText: { color: "#FFFFFF", fontSize: 33, lineHeight: 36 },
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 21 },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#CADDE3" },
  progressDotOn: { width: 28, backgroundColor: "#4BAFA5" },
  gameHeader: {
    width: "100%",
    maxWidth: 620,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 13,
    marginTop: 10,
  },
  headerCopy: { flex: 1 },
  stepEyebrow: { color: "#397C78", fontSize: 12, fontWeight: "900", letterSpacing: 1.1 },
  gameTitle: { marginTop: 3, color: "#32434B", fontSize: 25, fontWeight: "900" },
  listenButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
  },
  instructionCard: {
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderWidth: 2,
    borderColor: "#D9E9ED",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  instruction: {
    color: "#32434B",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 27,
    textAlign: "center",
  },
  roundArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  feedback: {
    minHeight: 48,
    maxWidth: 520,
    alignSelf: "center",
    color: "#49616B",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  momo: { alignItems: "center", justifyContent: "center" },
  momoFace: {
    zIndex: 2,
    width: "76%",
    height: "62%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#FFFFFF",
    borderRadius: 30,
    backgroundColor: "#56B9B0",
  },
  momoEyes: { flexDirection: "row", gap: 18 },
  momoEye: { width: 11, height: 17, borderRadius: 6, backgroundColor: "#24383F" },
  momoSmile: {
    width: 30,
    height: 15,
    marginTop: 8,
    borderBottomWidth: 4,
    borderColor: "#24383F",
    borderRadius: 16,
  },
  momoEar: {
    position: "absolute",
    zIndex: 1,
    top: "42%",
    width: "13%",
    height: "22%",
    borderRadius: 9,
    backgroundColor: "#3C8F8A",
  },
  momoEarLeft: { left: "5%" },
  momoEarRight: { right: "5%" },
  momoGlow: {
    position: "absolute",
    zIndex: 3,
    right: "24%",
    bottom: "21%",
    width: "10%",
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: "#F7CB52",
  },
  momoAntennaStem: {
    position: "absolute",
    top: 2,
    width: 4,
    height: 18,
    backgroundColor: "#3C8F8A",
  },
  momoAntennaStemLarge: { height: 32, width: 7 },
  momoAntennaTop: { position: "absolute", zIndex: 4, top: -7 },
  momoAntennaTopLarge: { top: -13 },
  momoAntennaDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: "#F7CB52" },
  momoAntennaDotLarge: { width: 25, height: 25, borderRadius: 13 },
  cableBoard: {
    width: "100%",
    maxWidth: 590,
    minHeight: 250,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 30,
    backgroundColor: "#DDE9EC",
  },
  cableColumn: { gap: 24 },
  cableEnd: { width: 116, height: 74, flexDirection: "row", alignItems: "center", zIndex: 5 },
  cableEndLeft: { justifyContent: "flex-end" },
  cableEndRight: { flexDirection: "row-reverse", justifyContent: "flex-end" },
  cableLine: { flex: 1, height: 14, borderRadius: 7 },
  cablePlug: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#FFFFFF",
    borderRadius: 20,
  },
  cableConnected: { opacity: 0.64 },
  cablePlugConnected: { borderColor: "#CFF3D5" },
  highlighted: {
    borderWidth: 5,
    borderColor: "#F7C948",
    borderRadius: 24,
    backgroundColor: "#FFF7C9",
  },
  powerCore: {
    width: 92,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 7,
    borderColor: "#FFFFFF",
    borderRadius: 28,
    backgroundColor: "#7892A4",
  },
  crystalRound: { width: "100%", maxWidth: 590, alignItems: "center" },
  crystalShelf: {
    minHeight: 150,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  crystalButton: {
    width: 88,
    height: 102,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 26,
    backgroundColor: "#EEE8FF",
  },
  crystalSelected: { opacity: 0.35, transform: [{ scale: 0.9 }] },
  energyBasket: {
    minWidth: 250,
    height: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginTop: 14,
    paddingHorizontal: 18,
    borderRadius: 30,
    backgroundColor: "#415C69",
  },
  energyCount: { minWidth: 36, color: "#FFFFFF", fontSize: 32, fontWeight: "900" },
  confirmButton: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    backgroundColor: "#4BAFA5",
  },
  patternRound: { width: "100%", maxWidth: 620, alignItems: "center" },
  patternSequence: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  patternTile: {
    width: 70,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 20,
    backgroundColor: "#E6EFF2",
  },
  missingTile: { borderStyle: "dashed", borderColor: "#7A98A4", backgroundColor: "#FFFFFF" },
  questionMark: { color: "#607D89", fontSize: 40, fontWeight: "900" },
  shapeChoices: { flexDirection: "row", gap: 18, marginTop: 28 },
  shapeChoice: {
    width: 112,
    height: 118,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 28,
    backgroundColor: "#F8FBFC",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  rewardScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  rewardTitle: {
    marginTop: 7,
    color: "#32434B",
    fontSize: 29,
    fontWeight: "900",
    textAlign: "center",
  },
  rewardChoices: { flexDirection: "row", gap: 18, marginTop: 26 },
  rewardCard: {
    width: 166,
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 30,
    backgroundColor: "#DFF1EF",
    shadowColor: "#47616B",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  rewardCardPressed: { transform: [{ scale: 0.96 }], backgroundColor: "#FFF2C9" },
  rewardLabel: {
    marginTop: 6,
    color: "#32434B",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  choosePill: {
    width: 48,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: "#4BAFA5",
  },
  finishCard: { flex: 1, alignItems: "center", justifyContent: "center" },
  finishEyebrow: { color: "#397C78", fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },
  finishTitle: { marginTop: 8, color: "#32434B", fontSize: 34, fontWeight: "900" },
  finishCopy: {
    maxWidth: 390,
    marginTop: 9,
    color: "#49616B",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 27,
    textAlign: "center",
  },
  exitButton: {
    marginTop: 25,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 25,
    backgroundColor: "#3C918A",
  },
  exitButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  sparkleOne: {
    position: "absolute",
    top: 90,
    left: 46,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FFF0A8",
  },
  sparkleTwo: {
    position: "absolute",
    right: 35,
    bottom: 110,
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: "#E4DAFA",
  },
});
