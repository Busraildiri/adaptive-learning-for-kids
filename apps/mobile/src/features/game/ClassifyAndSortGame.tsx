import type {
  ClassifyAndSortGame as ClassifyAndSortGameContent,
  SortObject,
} from "@adaptive/content-schema";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { useGameObservation } from "./GameObservationContext";

const minoHappy = require("../../../assets/characters/mino-happy.png");
const happyDog = require("../../../assets/game/sort/happy-dog-v1.png");
const toyBasket = require("../../../assets/game/sort/toy-basket-v1.png");
const blueBlock = require("../../../assets/game/sort/blue-block-v1.png");
const purpleBlock = require("../../../assets/game/sort/purple-block-v1.png");
const playBall = require("../../../assets/game/sort/play-ball-v1.png");
const greenBall = require("../../../assets/game/sort/green-ball-v1.png");
const redBall = require("../../../assets/game/sort/red-ball-v1.png");
const yellowStar = require("../../../assets/game/sort/yellow-star-v1.png");
const purpleCar = require("../../../assets/game/sort/purple-car-v1.png");
const greenPickup = require("../../../assets/game/sort/green-pickup-v1.png");
const redBalloon = require("../../../assets/game/sort/red-balloon-v1.png");
const iceCream = require("../../../assets/game/sort/ice-cream-v1.png");
const spinningTop = require("../../../assets/game/sort/spinning-top-v1.png");
const toothbrush = require("../../../assets/game/sort/toothbrush-v1.png");
const soap = require("../../../assets/game/sort/soap-v1.png");
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
    return <Image source={happyDog} style={styles.dogImage} />;
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
    <View style={[styles.iconBadge, { backgroundColor: `${color}24` }]}>
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
      const droppedInside =
        basketBounds &&
        gesture.moveX >= basketBounds.x &&
        gesture.moveX <= basketBounds.x + basketBounds.width &&
        gesture.moveY >= basketBounds.y &&
        gesture.moveY <= basketBounds.y + basketBounds.height;
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
        itemCount > 10 && styles.compactObjectCard,
        compareSize && object.size === "large" && itemCount <= 10 && styles.largeObjectCard,
        highlighted && styles.objectHighlighted,
        { transform: position.getTranslateTransform() },
      ]}
    >
      <ObjectArt
        compact={itemCount > 10}
        compareSize={compareSize}
        imageSource={imageSource}
        object={object}
      />
      <Text style={styles.dragHint}>Tut ve sürükle</Text>
    </Animated.View>
  );
}

export function ClassifyAndSortGame({
  announceIntro = true,
  game,
  onExit,
  onRestart,
}: {
  announceIntro?: boolean;
  game: ClassifyAndSortGameContent;
  onExit: () => void;
  onRestart: () => void;
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
  const shownInstruction = currentRound.instruction;

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (!game.presentation.playAudioInstructions) {
        onDone?.();
        return;
      }
      const token = speechToken.current + 1;
      speechToken.current = token;
      void Speech.stop().then(() => {
        if (!isMounted.current || speechToken.current !== token) return;
        const complete = () => {
          if (isMounted.current && speechToken.current === token) onDone?.();
        };
        Speech.speak(text, {
          language: "tr-TR",
          rate: 0.84,
          onDone: complete,
          onStopped: complete,
        });
      });
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
    setLocked(true);
    setHighlightedObjectId(null);
    setFeedback(roundIndex === 0 ? "" : "Kural değişti!");
    roundStartedAt.current = Date.now();
    speak(text, () => {
      if (roundIndex === 0 && !announceIntro) setLocked(false);
      else speak(shownInstruction, () => setLocked(false));
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
    roundIndex,
    speak,
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
        setFeedback("Birlikte bulalım: yönergeyi yeniden dinle.");
        speak(shownInstruction);
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
        <View style={styles.completedCard}>
          <Text style={styles.confetti}>✦ · ✧ · ✦</Text>
          <Image source={minoHappy} style={styles.mascotLarge} />
          <Text style={styles.completedTitle}>Bahçe tamamlandı!</Text>
          <Text style={styles.completedCopy}>{game.presentation.closingNarration}</Text>
          <View style={styles.finalGarden}>
            {gardenFlowers.map((flower, index) => (
              <Image key={`garden-flower-${index}`} source={flower} style={styles.finalFlower} />
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onRestart} style={styles.exitButton}>
            <Text style={styles.exitButtonText}>Tekrar başlamak için dokun</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={exitGame}>
            <Text style={styles.completedCopy}>Oyunlara dön</Text>
          </Pressable>
        </View>
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
      <View style={styles.gameArea}>
        <View style={styles.progressRow}>
          {game.rounds.map((round, index) => (
            <View
              key={round.id}
              style={[styles.progressSeed, index < collected && styles.progressFlower]}
            >
              {index < collected ? (
                <Image
                  source={gardenFlowers[index % gardenFlowers.length]}
                  style={styles.progressFlowerImage}
                />
              ) : (
                <Text style={styles.progressText}>•</Text>
              )}
            </View>
          ))}
        </View>
        <Animated.Image
          source={minoHappy}
          style={[styles.mascot, { transform: [{ scale: mascotScale }] }]}
        />
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.ruleCard}>
          {roundIndex > 0 ? <Text style={styles.ruleChanged}>KURAL DEĞİŞTİ!</Text> : null}
          <Text style={styles.instruction}>{shownInstruction}</Text>
        </View>
        <View
          style={[styles.objectGrid, currentRound.objects.length > 10 && styles.compactObjectGrid]}
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
          style={[styles.basket, { transform: [{ scale: basketBounce }] }]}
        >
          <Image source={toyBasket} style={styles.basketImage} />
        </Animated.View>
        <Text style={styles.feedback}>{locked && !feedback ? "Pati anlatıyor…" : feedback}</Text>
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
  gameArea: {
    zIndex: 2,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  progressRow: { height: 60, flexDirection: "row", gap: 8 },
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
  mascot: { width: 76, height: 76, resizeMode: "contain" },
  mascotLarge: { width: 150, height: 150, resizeMode: "contain" },
  title: { color: "#473A31", fontSize: 25, fontWeight: "900" },
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
  ruleChanged: { color: "#D56B54", fontSize: 12, fontWeight: "900", textAlign: "center" },
  instruction: {
    color: "#473A31",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 25,
    textAlign: "center",
  },
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
  compactObjectGrid: { maxWidth: 330 },
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
  },
  compactObjectCard: { width: 58, height: 66, borderRadius: 15, borderWidth: 2 },
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
  dogImage: { width: 82, height: 90, resizeMode: "contain" },
  dragHint: { marginTop: 2, color: "#7A6D61", fontSize: 10, fontWeight: "800" },
  basket: { width: 150, height: 112, alignItems: "center", marginTop: 5 },
  basketImage: { width: 150, height: 112, resizeMode: "contain" },
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
