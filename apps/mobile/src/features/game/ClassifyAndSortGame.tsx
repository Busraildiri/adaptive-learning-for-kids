import type {
  ClassifyAndSortGame as ClassifyAndSortGameContent,
  SortObject,
} from "@adaptive/content-schema";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
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
import { objectMatchesRound } from "./classifyAndSortEngine";
import { GameCompletionCard } from "./GameCompletionCard";
import { useGameObservation } from "./GameObservationContext";

const minoHappy = require("../../../assets/characters/mino-happy.png");
const happyDog = require("../../../assets/game/sort/happy-dog-v1.png");
const toyBasket = require("../../../assets/game/sort/toy-basket-v1.png");
const blueBlock = require("../../../assets/game/sort/blue-block-v2.png");
const purpleBlock = require("../../../assets/game/sort/purple-block-v1.png");
const playBall = require("../../../assets/game/sort/play-ball-v1.png");
const greenBall = require("../../../assets/game/sort/green-ball-v1.png");
const redBall = require("../../../assets/game/sort/red-ball-v1.png");
const yellowStar = require("../../../assets/game/sort/yellow-star-v1.png");
const purpleCar = require("../../../assets/game/sort/purple-car-v1.png");
const greenPickup = require("../../../assets/game/sort/green-car-v2.png");
const redBalloon = require("../../../assets/game/sort/red-balloon-v2.png");
const iceCream = require("../../../assets/game/sort/ice-cream-v1.png");
const spinningTop = require("../../../assets/game/sort/spinning-top-v1.png");
const toothbrush = require("../../../assets/game/sort/toothbrush-v1.png");
const soap = require("../../../assets/game/sort/purple-soap-v2.png");
const cat = require("../../../assets/game/sort/cat-v1.png");
const fox = require("../../../assets/game/sort/fox-v1.png");
const rabbit = require("../../../assets/game/sort/rabbit-v1.png");
const bear = require("../../../assets/game/sort/bear-v1.png");
const bed = require("../../../assets/game/sort/bed-v1.png");
const pajamas = require("../../../assets/game/sort/pajamas-v1.png");
const picnicBasket = require("../../../assets/game/sort/picnic-basket-v1.png");
const gardenFlowers = [
  require("../../../assets/game/garden/tulip-v1.png"),
  require("../../../assets/game/garden/sunflower-v1.png"),
  require("../../../assets/game/garden/peony-v1.png"),
  require("../../../assets/game/garden/hydrangea-v1.png"),
  require("../../../assets/game/garden/forget-me-not-v1.png"),
];

const colors = {
  red: "#E76B65",
  blue: "#5A9BD5",
  yellow: "#F3C64E",
  green: "#65B987",
  purple: "#9674C8",
} as const;

const sortImageByObjectId: Record<string, ImageSourcePropType> = {
  "blue-block": blueBlock,
  "small-purple-block": purpleBlock,
  "green-ball": greenBall,
  "small-red-ball": redBall,
  "yellow-star": yellowStar,
  "small-yellow-star": yellowStar,
  "purple-car": purpleCar,
  "large-green-car": greenPickup,
  "red-balloon": redBalloon,
  "purple-soap": soap,
  "green-toothbrush": toothbrush,
  "happy-dog": happyDog,
  "ice-cream": iceCream,
  "spinning-top": spinningTop,
  "large-play-ball": playBall,
  "small-play-ball-a": playBall,
  "small-play-ball-b": playBall,
  cat,
  fox,
  rabbit,
  bear,
  bed,
  pajamas,
  "picnic-basket": picnicBasket,
};

function ObjectArt({
  object,
  imageSource,
  compareSize,
  compact,
}: {
  object: SortObject;
  imageSource?: ImageSourcePropType;
  compareSize: boolean;
  compact: boolean;
}) {
  const report = useGameObservation();
  const color = colors[object.color];
  if (imageSource) {
    const size = compact ? 38 : compareSize ? (object.size === "large" ? 108 : 52) : 78;
    return (
      <Image source={imageSource} style={{ width: size, height: size, resizeMode: "contain" }} />
    );
  }
  if (object.shape === "bear") {
    return <Image source={happyDog} style={[styles.dogImage, compact && styles.compactDogImage]} />;
  }
  const iconName = {
    ball: "basketball",
    block: "cube",
    star: "star",
    car: "car-side",
    fish: "fish",
    bear: "teddy-bear",
  }[object.shape] as "basketball";
  const size = compact ? 34 : object.size === "large" ? 104 : 38;
  return (
    <View
      style={[
        styles.iconBadge,
        compact && styles.compactIconBadge,
        { backgroundColor: `${color}24` },
      ]}
    >
      <MaterialCommunityIcons color={color} name={iconName} size={size} />
    </View>
  );
}

type BasketBounds = { x: number; y: number; width: number; height: number };

function DraggableObject({
  object,
  enabled,
  highlighted,
  imageSource,
  compareSize,
  basketBounds,
  onDrop,
  itemCount,
}: {
  object: SortObject;
  enabled: boolean;
  highlighted: boolean;
  imageSource?: ImageSourcePropType;
  compareSize: boolean;
  basketBounds: BasketBounds | null;
  onDrop: (object: SortObject) => void;
  itemCount: number;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: (_, gesture) =>
      enabled && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
    onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gesture) => {
      const dropPadding = 48;
      const droppedOnMeasuredBasket =
        basketBounds &&
        gesture.moveX >= basketBounds.x - dropPadding &&
        gesture.moveX <= basketBounds.x + basketBounds.width + dropPadding &&
        gesture.moveY >= basketBounds.y - dropPadding &&
        gesture.moveY <= basketBounds.y + basketBounds.height + dropPadding;
      // Some iOS/Expo Go layouts report a stale basket measurement after the
      // dense grid settles. The basket is always in the lower part of Pati's
      // board, so retain a screen-coordinate fallback for that device case.
      const droppedOnBasketArea = gesture.moveY >= Dimensions.get("window").height * 0.54;
      const droppedInside = droppedOnMeasuredBasket || droppedOnBasketArea;
      if (droppedInside) onDrop(object);
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  });

  return (
    <Animated.View
      accessibilityLabel={`${object.label}. Sepete sürükle.`}
      accessible
      {...responder.panHandlers}
      style={[
        styles.objectCard,
        itemCount >= 8 && styles.compactObjectCard,
        itemCount >= 16 && styles.ultraCompactObjectCard,
        compareSize && object.size === "large" && itemCount <= 10 && styles.largeObjectCard,
        highlighted && styles.objectHighlighted,
        { transform: position.getTranslateTransform() },
      ]}
    >
      <ObjectArt
        compact={itemCount >= 8}
        compareSize={compareSize}
        imageSource={imageSource}
        object={object}
      />
      <Text
        numberOfLines={2}
        style={[
          styles.dragHint,
          itemCount >= 8 && styles.compactDragHint,
          itemCount >= 16 && styles.ultraCompactDragHint,
        ]}
      >
        Tut ve sürükle
      </Text>
    </Animated.View>
  );
}

export function ClassifyAndSortGame({
  announceIntro = true,
  adaptiveLevel,
  game,
  onExit,
  onInstructionSpoken,
  onRestart,
  wasInstructionSpoken,
}: {
  announceIntro?: boolean;
  adaptiveLevel: number;
  game: ClassifyAndSortGameContent;
  onExit: () => void;
  onInstructionSpoken: (instruction: string) => void;
  onRestart: () => void;
  wasInstructionSpoken: (instruction: string) => boolean;
}) {
  const report = useGameObservation();
  const [roundIndex, setRoundIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [locked, setLocked] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [collected, setCollected] = useState(0);
  const [basketBounds, setBasketBounds] = useState<BasketBounds | null>(null);
  const [highlightedObjectId, setHighlightedObjectId] = useState<string | null>(null);
  const roundStartedAt = useRef(Date.now());
  const speechToken = useRef(0);
  const isMounted = useRef(true);
  const basketRef = useRef<View>(null);
  const mascotScale = useRef(new Animated.Value(1)).current;
  const basketBounce = useRef(new Animated.Value(1)).current;
  const currentRound = game.rounds[roundIndex];
  const denseLayout = currentRound.objects.length >= 8;
  const ultraDenseLayout = currentRound.objects.length >= 16;
  const shownInstruction = currentRound.instruction;

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (!game.presentation.playAudioInstructions) {
        onDone?.();
        return;
      }
      const token = speechToken.current + 1;
      speechToken.current = token;
      let finished = false;
      const complete = () => {
        if (finished) return;
        finished = true;
        clearTimeout(fallbackTimer);
        if (isMounted.current && speechToken.current === token) onDone?.();
      };
      // Never leave the child unable to play if iOS TTS does not send a
      // completion event (for example after an interrupted audio session).
      const fallbackTimer = setTimeout(complete, 1_800);
      const startSpeech = () => {
        if (!isMounted.current || speechToken.current !== token) return;
        void setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "duckOthers",
        })
          .catch(() => undefined)
          .finally(() => {
            if (!isMounted.current || speechToken.current !== token) return;
            Speech.speak(text, {
              language: "tr-TR",
              rate: 0.84,
              volume: 1,
              useApplicationAudioSession: true,
              onDone: complete,
              onStopped: complete,
              onError: complete,
            });
          });
      };
      void Speech.stop()
        .catch(() => undefined)
        .finally(startSpeech);
    },
    [game.presentation.playAudioInstructions],
  );

  const exitGame = useCallback(() => {
    speechToken.current += 1;
    void Speech.stop();
    onExit();
  }, [onExit]);

  useEffect(
    () => () => {
      isMounted.current = false;
      speechToken.current += 1;
      void Speech.stop();
    },
    [],
  );

  useEffect(() => {
    const text =
      roundIndex === 0
        ? announceIntro
          ? game.presentation.introNarration
          : shownInstruction
        : game.presentation.ruleChangeNarration;
    // Narration must never block the child from interacting with the card.
    setLocked(false);
    setHighlightedObjectId(null);
    setFeedback(roundIndex === 0 ? "" : "Kural değişti!");
    roundStartedAt.current = Date.now();
    const speakInstructionOnce = () => {
      if (wasInstructionSpoken(shownInstruction)) {
        return;
      }
      onInstructionSpoken(shownInstruction);
      speak(shownInstruction);
    };
    speak(text, () => {
      if (roundIndex !== 0 || announceIntro) speakInstructionOnce();
    });
    Animated.sequence([
      Animated.timing(mascotScale, { toValue: 1.1, duration: 220, useNativeDriver: true }),
      Animated.spring(mascotScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    return () => {
      void Speech.stop();
    };
  }, [
    shownInstruction,
    announceIntro,
    game.presentation.introNarration,
    game.presentation.ruleChangeNarration,
    mascotScale,
    onInstructionSpoken,
    roundIndex,
    speak,
    wasInstructionSpoken,
  ]);

  const choose = (object: SortObject) => {
    if (locked || completed) return;
    const correct = objectMatchesRound(object, currentRound);
    report({ type: "attempt", stepId: currentRound.id, correct });
    if (!correct) {
      Vibration.vibrate(18);
      if (game.difficulty.secondTryEnabled && attempt === 0) {
        report({ type: "retry", stepId: currentRound.id });
        setAttempt(1);
        setFeedback(game.feedback.retry);
        speak(game.feedback.retry);
      } else {
        const message = "Birlikte bulalım. Sana ipucu gösteriyorum.";
        setFeedback(message);
        setHighlightedObjectId(
          currentRound.objects.find((candidate) => objectMatchesRound(candidate, currentRound))
            ?.id ?? null,
        );
        speak(message);
      }
      return;
    }

    setLocked(true);
    Vibration.vibrate(35);
    setCollected((value) => value + 1);
    setFeedback(game.feedback.matched);
    Animated.sequence([
      Animated.timing(basketBounce, {
        toValue: 1.18,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(basketBounce, { toValue: 1, useNativeDriver: true }),
    ]).start();
    void (Date.now() - roundStartedAt.current); // Tur süresi, ileride kişiselleştirme olayına bağlanacak.
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

  useEffect(() => {
    if (locked || completed) return;
    const timeout = setTimeout(() => {
      report({ type: "wait", stepId: currentRound.id, waitMs: game.difficulty.responseWindowMs });
      const matchingObject = currentRound.objects.find((object) =>
        objectMatchesRound(object, currentRound),
      );
      setLocked(true);
      setHighlightedObjectId(matchingObject?.id ?? null);
      setFeedback("Sorun değil. Sepete gidecek nesne parlıyor; yeni kurala geçiyoruz.");
      speak("Sorun değil. Doğru nesneyi birlikte bulduk.", () => {
        const advance = setTimeout(() => {
          if (roundIndex === game.rounds.length - 1) {
            report({ type: "completed", stepId: currentRound.id });
            setCompleted(true);
            speak(game.presentation.closingNarration);
          } else {
            setAttempt(0);
            setRoundIndex((value) => value + 1);
          }
        }, 1_200);
        return () => clearTimeout(advance);
      });
    }, game.difficulty.responseWindowMs);
    return () => clearTimeout(timeout);
  }, [completed, currentRound, game, locked, roundIndex, speak]);

  if (completed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <GameCompletionCard
          message={game.presentation.closingNarration}
          onExit={exitGame}
          onRestart={onRestart}
          title={game.title}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.sky} accessible={false}>
        <View style={styles.cloud} />
        <View style={styles.sun} />
      </View>
      <Pressable
        accessibilityLabel="Oyundan çık"
        accessibilityRole="button"
        hitSlop={10}
        onPress={exitGame}
        style={styles.parentButton}
      >
        <Text style={styles.parentButtonText}>×</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Yönergeyi yeniden dinle"
        accessibilityRole="button"
        onPress={() => speak(shownInstruction)}
        style={styles.audioButton}
      >
        <MaterialCommunityIcons color="#3C6E92" name="volume-high" size={28} />
      </Pressable>
      <View style={[styles.gameArea, denseLayout && styles.denseGameArea]}>
        <View style={[styles.progressRow, denseLayout && styles.compactProgressRow]}>
          {game.rounds.map((round, index) => (
            <View
              key={round.id}
              style={[
                styles.progressSeed,
                denseLayout && styles.compactProgressSeed,
                index < collected && styles.progressFlower,
              ]}
            >
              {index < collected ? (
                <Image
                  source={gardenFlowers[index % gardenFlowers.length]}
                  style={[
                    styles.progressFlowerImage,
                    denseLayout && styles.compactProgressFlowerImage,
                  ]}
                />
              ) : (
                <Text style={[styles.progressText, denseLayout && styles.compactProgressText]}>
                  •
                </Text>
              )}
            </View>
          ))}
        </View>
        <Animated.Image
          source={minoHappy}
          style={[
            styles.mascot,
            denseLayout && styles.compactMascot,
            { transform: [{ scale: mascotScale }] },
          ]}
        />
        <Text style={styles.levelLabel}>SEVİYE {adaptiveLevel}</Text>
        <Text style={[styles.title, denseLayout && styles.compactTitle]}>{game.title}</Text>
        <View style={[styles.ruleCard, denseLayout && styles.compactRuleCard]}>
          {roundIndex > 0 ? <Text style={styles.ruleChanged}>KURAL DEĞİŞTİ!</Text> : null}
          <Text style={[styles.instruction, denseLayout && styles.compactInstruction]}>
            {shownInstruction}
          </Text>
        </View>
        <View
          style={[
            styles.objectGrid,
            denseLayout && styles.compactObjectGrid,
            ultraDenseLayout && styles.ultraCompactObjectGrid,
          ]}
        >
          {currentRound.objects.map((object) => (
            <DraggableObject
              basketBounds={basketBounds}
              compareSize={currentRound.dimension === "size"}
              enabled={!locked}
              highlighted={highlightedObjectId === object.id}
              imageSource={
                sortImageByObjectId[object.id.replace(/-adaptive-(target|distractor)$/, "")]
              }
              itemCount={currentRound.objects.length}
              key={object.id}
              object={object}
              onDrop={choose}
            />
          ))}
        </View>
        <Animated.View
          onLayout={() =>
            basketRef.current?.measureInWindow((x, y, width, height) =>
              setBasketBounds({ x, y, width, height }),
            )
          }
          ref={basketRef}
          style={[
            styles.basket,
            denseLayout && styles.compactBasket,
            { transform: [{ scale: basketBounce }] },
          ]}
        >
          <Image
            source={toyBasket}
            style={[styles.basketImage, denseLayout && styles.compactBasketImage]}
          />
        </Animated.View>
        <Text style={[styles.feedback, denseLayout && styles.compactFeedback]}>
          {locked && !feedback ? "Pati anlatıyor…" : feedback}
        </Text>
      </View>
      <View style={styles.ground} accessible={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, overflow: "hidden", backgroundColor: "#EAF7FF", paddingHorizontal: 18 },
  sky: {
    position: "absolute",
    top: 34,
    right: 25,
    left: 25,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cloud: { width: 82, height: 28, borderRadius: 20, backgroundColor: "#FFFFFF", opacity: 0.85 },
  sun: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F8CE58" },
  ground: {
    position: "absolute",
    right: -30,
    bottom: -100,
    left: -30,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#B9DFA1",
  },
  parentButton: {
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
  parentButtonText: { color: "#FFFFFF", fontSize: 32, lineHeight: 35 },
  audioButton: {
    position: "absolute",
    zIndex: 3,
    top: 28,
    right: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
  },
  gameArea: {
    zIndex: 2,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  denseGameArea: { justifyContent: "flex-start", paddingTop: 74 },
  progressRow: { height: 60, flexDirection: "row", gap: 8 },
  compactProgressRow: { height: 34, gap: 5 },
  progressSeed: {
    width: 48,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#D8E8CE",
  },
  progressFlower: { backgroundColor: "#FFF1A8" },
  progressText: { color: "#DB8F42", fontSize: 20, fontWeight: "900" },
  compactProgressSeed: { width: 30, height: 32, borderRadius: 15 },
  compactProgressFlowerImage: { width: 22, height: 22 },
  compactProgressText: { fontSize: 14 },
  mascot: { width: 76, height: 76, resizeMode: "contain" },
  compactMascot: { width: 50, height: 50 },
  mascotLarge: { width: 150, height: 150, resizeMode: "contain" },
  levelLabel: { color: "#55776B", fontSize: 14, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: "#473A31", fontSize: 25, fontWeight: "900" },
  compactTitle: { fontSize: 22 },
  ruleCard: {
    minWidth: 280,
    marginTop: 7,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#463A31",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
  },
  compactRuleCard: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 7 },
  ruleChanged: { color: "#D56B54", fontSize: 12, fontWeight: "900", textAlign: "center" },
  instruction: {
    color: "#473A31",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 25,
    textAlign: "center",
  },
  compactInstruction: { fontSize: 17, lineHeight: 21 },
  objectGrid: {
    width: "100%",
    maxWidth: 530,
    minHeight: 126,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  compactObjectGrid: { maxWidth: 304, minHeight: 0, gap: 5, marginTop: 6 },
  objectCard: {
    width: 98,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 24,
    backgroundColor: "#FFF9EE",
    shadowColor: "#6D5B4E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    zIndex: 4,
    overflow: "hidden",
  },
  compactObjectCard: {
    width: 56,
    height: 88,
    borderRadius: 15,
    borderWidth: 2,
    paddingVertical: 4,
  },
  ultraCompactObjectGrid: { maxWidth: 284, gap: 3, marginTop: 4 },
  ultraCompactObjectCard: { width: 52, height: 58, borderRadius: 13, paddingVertical: 0 },
  largeObjectCard: { width: 130, height: 154, borderColor: "#F3B51B", borderWidth: 5 },
  objectPressed: { transform: [{ scale: 0.92 }], backgroundColor: "#FFF1C9" },
  objectHighlighted: {
    borderColor: "#F3B51B",
    borderWidth: 6,
    backgroundColor: "#FFF5C8",
  },
  iconBadge: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  compactIconBadge: { width: 44, height: 44, borderRadius: 14 },
  dogImage: { width: 82, height: 90, resizeMode: "contain" },
  compactDogImage: { width: 34, height: 36 },
  dragHint: { marginTop: 2, color: "#7A6D61", fontSize: 10, fontWeight: "800" },
  compactDragHint: { width: 52, minHeight: 22, fontSize: 9, lineHeight: 10, textAlign: "center" },
  ultraCompactDragHint: { width: 48, minHeight: 18, marginTop: 0, fontSize: 8, lineHeight: 9 },
  basket: { width: 150, height: 112, alignItems: "center", marginTop: 5 },
  basketImage: { width: 150, height: 112, resizeMode: "contain" },
  compactBasket: { width: 112, height: 84, marginTop: 2 },
  compactBasketImage: { width: 112, height: 84 },
  basketHandle: {
    width: 78,
    height: 42,
    borderWidth: 7,
    borderColor: "#A96E3D",
    borderBottomWidth: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  basketBody: {
    position: "absolute",
    bottom: 0,
    width: 120,
    height: 51,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#C98A4F",
  },
  basketLabel: { color: "#FFF7E4", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  feedback: {
    minHeight: 42,
    maxWidth: 320,
    marginTop: 7,
    color: "#5B5048",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  compactFeedback: { minHeight: 24, marginTop: 2, fontSize: 13 },
  ball: { width: 62, height: 62, borderRadius: 31, borderWidth: 5, borderColor: "#FFFFFF70" },
  block: { width: 62, height: 62, borderRadius: 13, borderWidth: 5, borderColor: "#FFFFFF70" },
  star: { fontSize: 72, lineHeight: 80 },
  carBody: { width: 73, height: 39, borderRadius: 13 },
  carWindow: {
    position: "absolute",
    top: 6,
    right: 15,
    width: 24,
    height: 15,
    borderRadius: 5,
    backgroundColor: "#DDF3F7",
  },
  wheelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 9,
    marginTop: -5,
  },
  wheel: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#4B4743" },
  fishWrap: { width: 80, height: 54, flexDirection: "row", alignItems: "center" },
  fishBody: { zIndex: 2, width: 58, height: 42, borderRadius: 24 },
  fishTail: {
    width: 0,
    height: 0,
    marginLeft: -4,
    borderTopWidth: 20,
    borderBottomWidth: 20,
    borderRightWidth: 28,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  eye: {
    position: "absolute",
    top: 11,
    left: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3F3A37",
  },
  bearWrap: { width: 73, height: 72, alignItems: "center", justifyContent: "center" },
  bearEar: { position: "absolute", top: 4, width: 27, height: 27, borderRadius: 14 },
  bearEarLeft: { left: 5 },
  bearEarRight: { right: 5 },
  bearHead: {
    width: 62,
    height: 59,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
    borderRadius: 29,
  },
  bearFace: { width: 27, height: 20, borderRadius: 12, backgroundColor: "#F7DCB2" },
  completedCard: { flex: 1, alignItems: "center", justifyContent: "center" },
  confetti: { color: "#E6A72E", fontSize: 38, fontWeight: "900" },
  completedTitle: { color: "#473A31", fontSize: 30, fontWeight: "900" },
  completedCopy: {
    maxWidth: 310,
    marginTop: 8,
    color: "#5B5048",
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  finalGarden: { height: 130, flexDirection: "row", alignItems: "flex-end", gap: 2, marginTop: 13 },
  finalFlower: { width: 55, height: 125, resizeMode: "contain" },
  progressFlowerImage: { width: 46, height: 56, resizeMode: "contain" },
  exitButton: {
    marginTop: 22,
    paddingHorizontal: 25,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#2D8C7C",
  },
  exitButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
});
