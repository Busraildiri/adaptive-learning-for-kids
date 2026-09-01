import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { loadGardenProgress, saveGardenProgress } from "../../services/gardenProgress";

const emptyGardenLandscape = require("../../../assets/game/garden/surpriz-bahcem-landscape-empty-v2.png");
const soilGardenLandscape = require("../../../assets/game/garden/surpriz-bahcem-landscape-soil-v3.png");
const seededGardenLandscape = require("../../../assets/game/garden/surpriz-bahcem-landscape-soil-seeds-v1.png");
const sproutedGardenLandscape = require("../../../assets/game/garden/surpriz-bahcem-landscape-soil-sprouts-v1.png");
const flowerGardenLandscape = require("../../../assets/game/garden/surpriz-bahcem-landscape-soil-sprouts-flowers-v3.png");
const fencedGardenLandscape = require("../../../assets/game/garden/surpriz-bahcem-landscape-soil-sprouts-flowers-fence-v2.png");
const appleTreeArt = require("../../../assets/game/garden/apple-tree-painterly-v1.png");
const appleTreeFruitingArt = require("../../../assets/game/garden/apple-tree-fruiting-painterly-v1.png");
const appleSaplingArt = require("../../../assets/game/garden/apple-sapling-painterly-v1.png");
const tomatoSeedsArt = require("../../../assets/game/garden/tomato-seeds-painterly-v1.png");
const strawberrySeedsArt = require("../../../assets/game/garden/strawberry-seeds-painterly-v1.png");
const gardenShedArt = require("../../../assets/game/garden/garden-shed-painterly-v1.png");
const coopGroundArt = require("../../../assets/game/garden/coop-ground-painterly-v1.png");
const chickenCoopArt = require("../../../assets/game/garden/chicken-coop-painterly-v1.png");
const henArt = require("../../../assets/game/garden/hen-painterly-v1.png");
const chickArt = require("../../../assets/game/garden/chick-painterly-v1.png");
const feedBowlArt = require("../../../assets/game/garden/feed-bowl-painterly-v1.png");
const chickenFeedArt = require("../../../assets/game/garden/chicken-feed-painterly-v1.png");
const doghouseArt = require("../../../assets/game/garden/doghouse-painterly-v2.png");
const eggBasketArt = require("../../../assets/game/garden/egg-basket-painterly-v2.png");
const pondArt = require("../../../assets/game/garden/pond-painterly-v2.png");
const duckArt = require("../../../assets/game/garden/duck-painterly-v1.png");
const frogArt = require("../../../assets/game/garden/frog-painterly-v1.png");
const emptyBeehiveArt = require("../../../assets/game/garden/beehive-painterly-v4.png");
const beeBeehiveArt = require("../../../assets/game/garden/beehive-painterly-v3.png");
const butterflyBeehiveArt = require("../../../assets/game/garden/beehive-painterly-v5.png");

type GardenReward = {
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  group: string;
  action: string;
};

const rewards: GardenReward[] = [
  ["Bahçe toprağı", "terrain", "İlk Bahçe", "Toprağa nazikçe dokun."],
  ["Havuç tohumu", "seed", "İlk Bahçe", "Tohumu toprağa bırak."],
  ["Sulama kabı", "watering-can", "İlk Bahçe", "Bitkiye biraz su ver."],
  ["Güneş", "weather-sunny", "İlk Bahçe", "Güneşin filizi ısıtmasını izle."],
  ["İlk filiz", "sprout", "İlk Bahçe", "Filizin büyümesini izle."],
  ["Çiçek yatağı", "flower-tulip", "İlk Bahçe", "Çiçeklerin kokusunu hayal et."],
  ["Ahşap çit", "fence", "İlk Bahçe", "Çiti bahçenin kenarına yerleştir."],
  ["Domates tohumu", "seed", "Sebzeler ve Meyveler", "Tohumu toprağa bırak."],
  ["Çilek tohumu", "seed", "Sebzeler ve Meyveler", "Tohumu toprağa bırak."],
  ["Elma fidanı", "tree", "Sebzeler ve Meyveler", "Fidanı toprağa yerleştir."],
  ["Elma ağacı", "tree", "Sebzeler ve Meyveler", "Dalların hafifçe sallanışını izle."],
  ["Elma ağacını sula", "watering-can", "Sebzeler ve Meyveler", "Ağacı suyla büyüt."],
  ["Bahçe kulübesi", "home-variant", "Sebzeler ve Meyveler", "Kulübenin kapısını selamla."],
  ["Köpek kulübesi", "dog-side", "Sebzeler ve Meyveler", "Kulübeyi çimenlerin üzerine yerleştir."],
  ["Kümes zemini", "grid", "Tavuk Kümesi", "Kümes için yumuşak bir yer hazırla."],
  ["Tavuk kümesi", "home-roof", "Tavuk Kümesi", "Kümesi bahçene yerleştir."],
  ["İlk tavuk", "bird", "Tavuk Kümesi", "Tavuğu kümese götür."],
  ["Civciv", "bird", "Tavuk Kümesi", "Civcivi tavuğun yanına koy."],
  ["Yem kabı", "bowl", "Tavuk Kümesi", "Yem kabını kümese yerleştir."],
  ["Tavuk yemi", "barley", "Tavuk Kümesi", "Yemi kaba bırak."],
  ["Yumurta sepeti", "basket", "Tavuk Kümesi", "Sepeti yuvanın yanına koy."],
  ["Küçük gölet", "water", "Gölet ve Canlılar", "Suyun dalgalarını izle."],
  ["Ördek", "duck", "Gölet ve Canlılar", "Ördeği gölete götür."],
  ["Kurbağa", "frog", "Gölet ve Canlılar", "Kurbağanın zıplayışını izle."],
  ["Arı kovanı", "hexagon-multiple", "Gölet ve Canlılar", "Kovanı çiçeklerin yakınına koy."],
  ["Arılar", "bee", "Gölet ve Canlılar", "Arıların usulca vızıldamasını dinle."],
  ["Kelebekler", "butterfly", "Gölet ve Canlılar", "Kelebeklerin hafifçe uçuşunu izle."],
].map(([name, icon, group, action]) => ({
  name,
  icon: icon as GardenReward["icon"],
  group,
  action,
}));

function SeedPlot({ kind }: { kind: "tomato" | "strawberry" }) {
  const isTomato = kind === "tomato";
  const seedArt = isTomato ? tomatoSeedsArt : strawberrySeedsArt;
  return (
    <View
      accessibilityLabel={
        isTomato ? "Toprağa ekilmiş domates tohumları" : "Toprağa ekilmiş çilek tohumları"
      }
      style={[styles.plantedSeedRow, isTomato ? styles.tomatoSeedRow : styles.strawberrySeedRow]}
    >
      <Image source={seedArt} style={styles.plotSeedArt} />
    </View>
  );
}

export function SurprizBahcemGame({ childId, onExit }: { childId: string; onExit: () => void }) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [placedCount, setPlacedCount] = useState<number | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [ambientOn, setAmbientOn] = useState(false);
  const [appleTreeStage, setAppleTreeStage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOverGarden, setIsOverGarden] = useState(false);
  const gardenRef = useRef<View>(null);
  const gardenBounds = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const dragPosition = useRef(new Animated.ValueXY()).current;
  const gardenSway = useRef(new Animated.Value(0)).current;
  const birdPlayer = useAudioPlayer(require("../../../assets/audio/lumi/bird.mp3"));
  const waterPlayer = useAudioPlayer(require("../../../assets/audio/lumi/rain.mp3"));
  useEffect(() => {
    void loadGardenProgress(childId).then((progress) => {
      setPlacedCount(progress.placedCount);
      setAppleTreeStage(progress.appleTreeStage);
    });
  }, [childId]);
  const next = placedCount === null || placedCount >= rewards.length ? null : rewards[placedCount];
  const gardenItems = useMemo(() => rewards.slice(0, placedCount ?? 0), [placedCount]);
  const hasSoil = gardenItems.some((item) => item.name === "Bahçe toprağı");
  const hasCarrotSeeds = gardenItems.some((item) => item.name === "Havuç tohumu");
  const hasSun = gardenItems.some((item) => item.name === "Güneş");
  const hasFirstSprout = gardenItems.some((item) => item.name === "İlk filiz");
  const hasFlowerBed = gardenItems.some((item) => item.name === "Çiçek yatağı");
  const hasFence = gardenItems.some((item) => item.name === "Ahşap çit");
  const hasTomatoSeeds = gardenItems.some((item) => item.name === "Domates tohumu");
  const hasStrawberrySeeds = gardenItems.some((item) => item.name === "Çilek tohumu");
  const hasAppleSapling = gardenItems.some((item) => item.name === "Elma fidanı");
  const hasAppleTreeReward = gardenItems.some((item) => item.name === "Elma ağacı");
  const hasAppleFruitCare = gardenItems.some((item) => item.name === "Elma ağacını sula");
  const hasWateringCan = gardenItems.some((item) => item.name === "Sulama kabı");
  const hasGardenShed = gardenItems.some((item) => item.name === "Bahçe kulübesi");
  const hasCoopGround = gardenItems.some((item) => item.name === "Kümes zemini");
  const hasChickenCoop = gardenItems.some((item) => item.name === "Tavuk kümesi");
  const hasHen = gardenItems.some((item) => item.name === "İlk tavuk");
  const hasChick = gardenItems.some((item) => item.name === "Civciv");
  const hasFeedBowl = gardenItems.some((item) => item.name === "Yem kabı");
  const hasChickenFeed = gardenItems.some((item) => item.name === "Tavuk yemi");
  const hasEggBasket = gardenItems.some((item) => item.name === "Yumurta sepeti");
  const hasDoghouse = gardenItems.some((item) => item.name === "Köpek kulübesi");
  const hasPond = gardenItems.some((item) => item.name === "Küçük gölet");
  const hasDuck = gardenItems.some((item) => item.name === "Ördek");
  const hasFrog = gardenItems.some((item) => item.name === "Kurbağa");
  const hasBeehive = gardenItems.some((item) => item.name === "Arı kovanı");
  const hasBees = gardenItems.some((item) => item.name === "Arılar");
  const hasButterflies = gardenItems.some((item) => item.name === "Kelebekler");
  const gardenHeight = Math.max(560, Math.min(windowHeight * 0.78, windowWidth * 1.85));
  const gardenWallpaper = hasFence
    ? fencedGardenLandscape
    : hasFlowerBed
      ? flowerGardenLandscape
      : hasSoil
        ? hasFirstSprout
          ? sproutedGardenLandscape
          : hasCarrotSeeds
            ? seededGardenLandscape
            : soilGardenLandscape
        : emptyGardenLandscape;
  const place = useCallback(() => {
    if (placedCount === null || !next) return;
    const count = placedCount + 1;
    setPlacedCount(count);
    setBoxOpen(false);
    void saveGardenProgress(childId, count, appleTreeStage);
    if (count === rewards.length) setShowCompleted(true);
  }, [appleTreeStage, childId, next, placedCount]);
  const waterAppleTree = () => {
    if (placedCount === null) return;
    const nextStage = Math.min(2, appleTreeStage + 1);
    setAppleTreeStage(nextStage);
    void saveGardenProgress(childId, placedCount, nextStage);
  };
  const replayGarden = () => {
    setPlacedCount(0);
    setAppleTreeStage(0);
    setBoxOpen(false);
    setShowCompleted(false);
    setAmbientOn(false);
    dragPosition.setValue({ x: 0, y: 0 });
    void saveGardenProgress(childId, 0, 0);
  };
  const dragResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragPosition.stopAnimation();
          dragPosition.setValue({ x: 0, y: 0 });
          setIsDragging(true);
          gardenRef.current?.measureInWindow((x, y, width, height) => {
            gardenBounds.current = { x, y, width, height };
          });
        },
        onPanResponderMove: (_, gesture) => {
          dragPosition.setValue({ x: gesture.dx, y: gesture.dy });
          const bounds = gardenBounds.current;
          const padding = 28;
          setIsOverGarden(
            gesture.moveX >= bounds.x - padding &&
              gesture.moveX <= bounds.x + bounds.width + padding &&
              gesture.moveY >= bounds.y - padding &&
              gesture.moveY <= bounds.y + bounds.height + padding,
          );
        },
        onPanResponderRelease: (_, gesture) => {
          const bounds = gardenBounds.current;
          const padding = 36;
          const droppedInGarden =
            gesture.moveX >= bounds.x - padding &&
            gesture.moveX <= bounds.x + bounds.width + padding &&
            gesture.moveY >= bounds.y - padding &&
            gesture.moveY <= bounds.y + bounds.height + padding;
          setIsDragging(false);
          setIsOverGarden(false);
          if (droppedInGarden) place();
          Animated.spring(dragPosition, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          setIsDragging(false);
          setIsOverGarden(false);
          Animated.spring(dragPosition, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        },
      }),
    [dragPosition, place],
  );
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(gardenSway, { toValue: 1, duration: 3400, useNativeDriver: true }),
        Animated.timing(gardenSway, { toValue: 0, duration: 3400, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [gardenSway]);
  useEffect(() => {
    try {
      birdPlayer.loop = true;
      birdPlayer.volume = 0.09;
      waterPlayer.loop = true;
      waterPlayer.volume = 0.035;
      if (ambientOn) {
        birdPlayer.play();
        waterPlayer.play();
      } else {
        birdPlayer.pause();
        waterPlayer.pause();
      }
    } catch {
      // Sound is optional: the calm play loop remains usable if a device blocks audio.
    }
    return () => {
      try {
        birdPlayer.pause();
        waterPlayer.pause();
      } catch {
        // Native audio may have been released during screen navigation.
      }
    };
  }, [ambientOn, birdPlayer, waterPlayer]);
  if (placedCount === null)
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#4B9B5B" size="large" />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!isDragging}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Bahçeden çık" onPress={onExit} style={styles.back}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#315C37" />
          </Pressable>
          <View>
            <Text style={styles.eyebrow}>Sakinlik ve Doğa · 4–7 yaş</Text>
            <Text style={styles.title}>Sürpriz Bahçem</Text>
          </View>
        </View>
        <Animated.View
          ref={gardenRef}
          style={[
            styles.garden,
            {
              height: gardenHeight,
              transform: [
                {
                  translateX: gardenSway.interpolate({ inputRange: [0, 1], outputRange: [-1, 1] }),
                },
              ],
            },
          ]}
        >
          <ImageBackground
            fadeDuration={500}
            source={gardenWallpaper}
            style={styles.landscape}
            resizeMode="cover"
          />
          {hasSun ? <Text style={styles.sun}>☀️</Text> : null}
          {hasTomatoSeeds ? <SeedPlot kind="tomato" /> : null}
          {hasStrawberrySeeds ? <SeedPlot kind="strawberry" /> : null}
          {hasAppleSapling ? (
            <View
              accessibilityLabel={
                appleTreeStage === 0
                  ? "Küçük elma fidanı"
                  : appleTreeStage === 1
                    ? "Büyümüş elma ağacı"
                    : "Elmalı büyümüş elma ağacı"
              }
              style={[styles.appleTree, styles.landscapeAppleTree]}
            >
              <Image
                source={
                  appleTreeStage === 0
                    ? appleSaplingArt
                    : appleTreeStage === 2
                      ? appleTreeFruitingArt
                      : appleTreeArt
                }
                style={[
                  styles.appleTreeArt,
                  appleTreeStage > 0 ? styles.appleTreeArtGrown : styles.appleSaplingArt,
                ]}
              />
            </View>
          ) : null}
          {hasGardenShed ? <Image source={gardenShedArt} style={styles.gardenShedArt} /> : null}
          {hasDoghouse ? <Image source={doghouseArt} style={styles.doghouseArt} /> : null}
          {hasPond ? <Image source={pondArt} style={styles.pondArt} /> : null}
          {hasDuck ? <Image source={duckArt} style={styles.duckArt} /> : null}
          {hasFrog ? <Image source={frogArt} style={styles.frogArt} /> : null}
          {hasBeehive ? (
            <Image
              source={
                hasButterflies ? butterflyBeehiveArt : hasBees ? beeBeehiveArt : emptyBeehiveArt
              }
              style={styles.beehiveArt}
            />
          ) : null}
          {hasCoopGround ? <Image source={coopGroundArt} style={styles.coopGroundArt} /> : null}
          {hasChickenCoop ? <Image source={chickenCoopArt} style={styles.chickenCoopArt} /> : null}
          {hasHen ? <Image source={henArt} style={styles.henArt} /> : null}
          {hasChick ? <Image source={chickArt} style={styles.chickArt} /> : null}
          {hasFeedBowl ? <Image source={feedBowlArt} style={styles.feedBowlArt} /> : null}
          {hasChickenFeed ? <Image source={chickenFeedArt} style={styles.chickenFeedArt} /> : null}
          {hasEggBasket ? <Image source={eggBasketArt} style={styles.eggBasketArt} /> : null}
          <View style={styles.itemCloud}>
            {placedCount === 0 ? (
              <Text style={styles.empty}>İlk kutunu açarak bahçene başla.</Text>
            ) : null}
          </View>
          {hasAppleSapling &&
          hasWateringCan &&
          ((hasAppleTreeReward && appleTreeStage === 0) ||
            (hasAppleFruitCare && appleTreeStage === 1)) ? (
            <Pressable
              accessibilityLabel="Elma fidanını sula"
              onPress={waterAppleTree}
              style={styles.waterTreeButton}
            >
              <MaterialCommunityIcons color="#FFFFFF" name="watering-can" size={19} />
              <Text style={styles.waterTreeText}>
                {appleTreeStage === 0 ? "Ağacı sula" : "Elmaları büyüt"}
              </Text>
            </Pressable>
          ) : null}
          {isDragging ? (
            <View
              pointerEvents="none"
              style={[styles.dropGuide, isOverGarden && styles.dropGuideReady]}
            >
              <MaterialCommunityIcons
                color={isOverGarden ? "#FFFFFF" : "#315C37"}
                name={isOverGarden ? "check-circle" : "arrow-up-bold-circle"}
                size={25}
              />
              <Text style={[styles.dropGuideText, isOverGarden && styles.dropGuideTextReady]}>
                {isOverGarden ? "Şimdi bırak" : "Bahçeye getir"}
              </Text>
            </View>
          ) : null}
        </Animated.View>
        {next ? (
          <View style={styles.card}>
            <Text style={styles.step}>
              Kutu {placedCount + 1} / {rewards.length} · {next.group}
            </Text>
            <View style={styles.boxRow}>
              <View style={styles.box}>
                <MaterialCommunityIcons
                  name={boxOpen ? next.icon : "gift-outline"}
                  size={62}
                  color="#B46E31"
                />
              </View>
              <View style={styles.copy}>
                <Text style={styles.reward}>{boxOpen ? next.name : "Sürpriz kutu"}</Text>
                <Text style={styles.hint}>
                  {boxOpen ? next.action : "İstediğin zaman kutuya dokun."}
                </Text>
              </View>
            </View>
            {!boxOpen ? (
              <Pressable onPress={() => setBoxOpen(true)} style={styles.primary}>
                <Text style={styles.primaryText}>Kutuyu aç</Text>
              </Pressable>
            ) : (
              <View style={styles.dragArea}>
                <Text style={styles.dragHint}>
                  {isDragging
                    ? "Parmağını bahçenin içine götür."
                    : "Sürprizi bahçeye sürükle ve bırak."}
                </Text>
                <Animated.View
                  {...dragResponder.panHandlers}
                  accessibilityHint="Yukarı sürükleyip bahçeye bırak"
                  accessibilityLabel={`${next.name} ödülünü bahçeye sürükle`}
                  accessibilityRole="button"
                  style={[
                    styles.dragReward,
                    isDragging && styles.dragRewardActive,
                    { transform: dragPosition.getTranslateTransform() },
                  ]}
                >
                  <MaterialCommunityIcons color="#FFFFFF" name={next.icon} size={36} />
                  <Text style={styles.dragRewardText}>{next.name}</Text>
                </Animated.View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.completedCard}>
            <MaterialCommunityIcons name="flower-tulip" size={58} color="#3C9A55" />
            <Text style={styles.completedTitle}>BAHÇEN TAMAMLANDI!</Text>
            <Text style={styles.completedText}>
              Bahçen hep burada. İstediğin zaman gel, dinlen ve keşfet.
            </Text>
            <Pressable onPress={() => setAmbientOn((current) => !current)} style={styles.visit}>
              <Text style={styles.visitText}>
                {ambientOn ? "Doğa seslerini durdur" : "Doğa seslerini aç"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Bahçeyi yeniden oyna"
              onPress={replayGarden}
              style={styles.replay}
            >
              <MaterialCommunityIcons color="#3F9954" name="restart" size={21} />
              <Text style={styles.replayText}>Yeniden oynamak için dokun</Text>
            </Pressable>
          </View>
        )}
        {showCompleted ? (
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>BAHÇEN TAMAMLANDI!</Text>
              <Text style={styles.modalText}>
                {rewards.length} sürprizinle çok güzel bir bahçe oluşturdun.
              </Text>
              <Pressable onPress={() => setShowCompleted(false)} style={styles.visit}>
                <Text style={styles.visitText}>Bahçeme dön</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Bahçeyi yeniden oyna"
                onPress={replayGarden}
                style={styles.replay}
              >
                <MaterialCommunityIcons color="#3F9954" name="restart" size={21} />
                <Text style={styles.replayText}>Yeniden oynamak için dokun</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EFF9EE" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF9EE" },
  content: { padding: 18, paddingBottom: 42 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  back: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  eyebrow: { color: "#558161", fontSize: 12, fontWeight: "800" },
  title: { color: "#315C37", fontSize: 29, fontWeight: "900" },
  garden: {
    overflow: "hidden",
    borderRadius: 30,
    backgroundColor: "#91CD74",
    padding: 16,
  },
  skyStrip: { position: "absolute", top: 0, right: 0, left: 0, backgroundColor: "#BEE7F5" },
  landscape: { ...StyleSheet.absoluteFillObject },
  sun: { position: "absolute", zIndex: 1, right: 20, top: 13, fontSize: 42 },
  cloud: { position: "absolute", zIndex: 1, left: 24, top: 22, fontSize: 31 },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#91CD74",
  },
  soilBed: {
    position: "absolute",
    zIndex: 1,
    bottom: 50,
    left: "12%",
    width: "55%",
    height: 105,
    overflow: "hidden",
    borderRadius: 48,
  },
  soilBedArt: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  carrotSprouts: {
    position: "absolute",
    zIndex: 3,
    left: "12%",
    bottom: "13%",
    width: "76%",
    height: "72%",
    resizeMode: "contain",
  },
  flowerBed: {
    position: "absolute",
    zIndex: 2,
    right: 18,
    bottom: 220,
    width: 145,
    height: 138,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  flowerBedSoil: {
    position: "absolute",
    right: 3,
    bottom: 2,
    left: 3,
    height: 31,
    borderWidth: 3,
    borderColor: "#855027",
    borderRadius: 20,
    backgroundColor: "#B97035",
  },
  bedFlower: { position: "absolute", resizeMode: "contain" },
  bedTulip: { bottom: 13, left: 4, width: 55, height: 108 },
  bedSunflower: { right: 2, bottom: 12, width: 74, height: 125 },
  bedPeony: { bottom: 14, left: 49, width: 60, height: 108 },
  fenceFrame: {
    position: "absolute",
    zIndex: 3,
    bottom: 42,
    left: "8%",
    width: "63%",
    height: 124,
  },
  fencePost: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 11,
    borderWidth: 2,
    borderColor: "#77451F",
    borderRadius: 6,
    backgroundColor: "#C98243",
  },
  fencePostLeft: { left: 0 },
  fencePostRight: { right: 0 },
  fenceRail: {
    position: "absolute",
    right: 5,
    left: 5,
    height: 11,
    borderWidth: 2,
    borderColor: "#77451F",
    borderRadius: 5,
    backgroundColor: "#D99652",
  },
  fenceRailTop: { top: 27 },
  fenceRailBottom: { bottom: 26 },
  plantedSeedRow: {
    position: "absolute",
    zIndex: 3,
    width: 82,
    height: 47,
  },
  tomatoSeedRow: { bottom: 178, left: "4%" },
  strawberrySeedRow: { bottom: 119, left: "27%" },
  plotSeedArt: { ...StyleSheet.absoluteFillObject, resizeMode: "contain" },
  appleTree: {
    position: "absolute",
    zIndex: 1,
    right: "8%",
    bottom: 55,
    width: 105,
    height: 145,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  appleTreeArt: { position: "absolute", resizeMode: "contain" },
  appleSaplingArt: { bottom: -2, width: 82, height: 133 },
  appleTreeArtGrown: { bottom: -9, width: 144, height: 215 },
  landscapeAppleTree: {
    zIndex: 0,
    top: "13%",
    right: "39%",
    bottom: undefined,
    transform: [{ scale: 0.88 }],
  },
  gardenShedArt: {
    position: "absolute",
    zIndex: 2,
    left: "2%",
    bottom: 245,
    width: 105,
    height: 125,
    resizeMode: "contain",
  },
  doghouseArt: {
    position: "absolute",
    zIndex: 2,
    right: "30%",
    bottom: 240,
    width: 105,
    height: 118,
    resizeMode: "contain",
  },
  pondArt: {
    position: "absolute",
    zIndex: 3,
    right: "0%",
    bottom: 350,
    width: 190,
    height: 132,
    resizeMode: "contain",
  },
  duckArt: {
    position: "absolute",
    zIndex: 4,
    right: "15%",
    bottom: 380,
    width: 83,
    height: 65,
    resizeMode: "contain",
  },
  frogArt: {
    position: "absolute",
    zIndex: 5,
    right: "31%",
    bottom: 371,
    width: 61,
    height: 53,
    resizeMode: "contain",
  },
  beehiveArt: {
    position: "absolute",
    zIndex: 2,
    left: "2%",
    bottom: 410,
    width: 96,
    height: 118,
    resizeMode: "contain",
  },
  coopGroundArt: {
    position: "absolute",
    zIndex: 1,
    right: "3%",
    bottom: 38,
    width: 178,
    height: 92,
    resizeMode: "contain",
  },
  chickenCoopArt: {
    position: "absolute",
    zIndex: 2,
    right: "3%",
    bottom: 59,
    width: 164,
    height: 178,
    resizeMode: "contain",
  },
  henArt: {
    position: "absolute",
    zIndex: 4,
    right: "20%",
    bottom: 33,
    width: 70,
    height: 82,
    resizeMode: "contain",
  },
  chickArt: {
    position: "absolute",
    zIndex: 4,
    right: "11%",
    bottom: 36,
    width: 44,
    height: 46,
    resizeMode: "contain",
  },
  feedBowlArt: {
    position: "absolute",
    zIndex: 4,
    right: "5%",
    bottom: 33,
    width: 38,
    height: 30,
    resizeMode: "contain",
  },
  chickenFeedArt: {
    position: "absolute",
    zIndex: 4,
    right: "3%",
    bottom: 13,
    width: 45,
    height: 28,
    resizeMode: "contain",
  },
  eggBasketArt: {
    position: "absolute",
    zIndex: 4,
    right: "25%",
    bottom: 19,
    width: 43,
    height: 49,
    resizeMode: "contain",
  },
  appleTrunk: {
    position: "absolute",
    bottom: 0,
    width: 16,
    borderRadius: 9,
    backgroundColor: "#875229",
  },
  appleTrunkSmall: { height: 55 },
  appleTrunkGrown: { height: 77, width: 20 },
  appleCrown: {
    position: "absolute",
    borderWidth: 4,
    borderColor: "#357B44",
    backgroundColor: "#5FAE56",
  },
  appleCrownSmall: { bottom: 43, width: 55, height: 55, borderRadius: 29 },
  appleCrownGrown: { bottom: 58, width: 96, height: 89, borderRadius: 48 },
  appleFruit: {
    position: "absolute",
    zIndex: 2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#DE4F35",
  },
  appleFruitOne: { top: 31, left: 26 },
  appleFruitTwo: { top: 44, right: 23 },
  appleFruitThree: { top: 61, left: 45 },
  waterTreeButton: {
    position: "absolute",
    zIndex: 5,
    right: 14,
    bottom: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: "#368FAD",
  },
  waterTreeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  dropGuide: {
    position: "absolute",
    zIndex: 20,
    top: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
  },
  dropGuideReady: {
    borderColor: "#E6F7E8",
    backgroundColor: "rgba(55, 151, 78, 0.94)",
  },
  dropGuideText: { color: "#315C37", fontSize: 14, fontWeight: "900" },
  dropGuideTextReady: { color: "#FFFFFF" },
  itemCloud: {
    zIndex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
    marginTop: 24,
  },
  empty: { color: "#315C37", fontSize: 15, fontWeight: "800", textAlign: "center" },
  card: { marginTop: 18, padding: 18, borderRadius: 28, backgroundColor: "#FFFDF4" },
  step: { color: "#8B7145", fontSize: 12, fontWeight: "900" },
  boxRow: { flexDirection: "row", alignItems: "center", gap: 15, marginVertical: 14 },
  box: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8D69C",
  },
  copy: { flex: 1 },
  reward: { color: "#315C37", fontSize: 21, fontWeight: "900" },
  hint: { marginTop: 6, color: "#647267", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  primary: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#4B9B5B",
  },
  primaryText: { color: "#FFF", fontSize: 17, fontWeight: "900" },
  dragArea: { alignItems: "center", paddingTop: 2 },
  dragHint: { marginBottom: 10, color: "#647267", fontSize: 13, fontWeight: "800" },
  dragReward: {
    minWidth: 190,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 22,
    backgroundColor: "#4B9B5B",
    shadowColor: "#315C37",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
  },
  dragRewardActive: {
    zIndex: 30,
    borderColor: "#DDF2DF",
    shadowOpacity: 0.3,
    shadowRadius: 11,
    elevation: 12,
  },
  dragRewardText: { maxWidth: 130, color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  completedCard: {
    alignItems: "center",
    marginTop: 18,
    padding: 28,
    borderRadius: 28,
    backgroundColor: "#FFFDF4",
  },
  completedTitle: {
    marginTop: 11,
    color: "#31934F",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },
  completedText: {
    marginTop: 8,
    color: "#617465",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
  },
  visit: {
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: "#3F9954",
  },
  visitText: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  replay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderWidth: 2,
    borderColor: "#8FC69B",
    borderRadius: 18,
    backgroundColor: "#F4FBF2",
  },
  replayText: { color: "#357A45", fontSize: 14, fontWeight: "900" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#315C3780",
  },
  modal: { alignItems: "center", padding: 28, borderRadius: 28, backgroundColor: "#FFFDF4" },
  modalTitle: { color: "#31934F", fontSize: 26, fontWeight: "900", textAlign: "center" },
  modalText: {
    marginTop: 10,
    color: "#617465",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
  },
});
