import type { AgeBand, Asset, Game, GameDifficultyLevel, Story } from "@adaptive/content-schema";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createStorySelectionCards } from "./storySelection";

const routineGameIcon = require("../../../assets/game/home/morning-routine.png");
const sortGameIcon = require("../../../assets/game/home/sort-basket.png");
const lightGardenGameIcon = require("../../../assets/game/home/light-garden.png");
const emotionGameIcon = require("../../../assets/game/emotion/happy-rabbit-v2.png");
const fishGameIcon = require("../../../assets/game/home/fish-patterns.png");
const balloonGameIcon = require("../../../assets/game/balloon/balloon-pink-v1.png");
const defaultMiniGameIcon = require("../../../assets/game/home/sound-rhythm.png");
const miniGameIcons = {
  "nino-sound-rhythm-001": require("../../../assets/game/home/sound-rhythm.png"),
  "maya-morning-order-001": require("../../../assets/game/home/morning-routine.png"),
  "riko-where-001": require("../../../assets/game/home/spatial-crate.png"),
  "zuzu-missing-piece-001": require("../../../assets/game/home/missing-blocks.png"),
  "kiki-big-small-shop-001": require("../../../assets/game/home/big-small-acorns.png"),
  "piko-pattern-train-001": require("../../../assets/game/home/light-path.png"),
  "mavi-shadow-pairs-001": require("../../../assets/game/home/missing-blocks.png"),
  "lumi-sound-hunt-001": require("../../../assets/game/home/sound-rhythm.png"),
  "toko-little-map-001": require("../../../assets/game/home/spatial-crate.png"),
};
const storyCoverImages: Record<string, ImageSourcePropType> = {
  "mino-balloon-story": require("../../../assets/characters/mino-happy.png"),
  "mino-block-tower-story": require("../../../assets/characters/mino-sad-v2.png"),
  "mino-friend-goodbye-story": require("../../../assets/characters/mino-happy.png"),
  "mirmir-red-balloon-story": require("../../../assets/characters/mirmir-happy.jpg"),
  "mino-lost-toy-story": require("../../../assets/characters/mino-sad-v2.png"),
};

const difficultyLabels: Record<GameDifficultyLevel, string> = {
  starter: "Başlangıç",
  growing: "Gelişen",
  advanced: "İleri",
};

export function StorySelectionScreen({
  stories,
  assets,
  ageBand,
  childName,
  onSelectStory,
  onRequestParentArea,
  recommendedStoryId,
  recommendedGameId,
  gameRecommendationExplanation,
  games,
  onSelectGame,
}: {
  stories: Story[];
  assets: Asset[];
  ageBand: AgeBand;
  childName: string;
  onSelectStory: (storyId: string) => void;
  onRequestParentArea: () => void;
  recommendedStoryId: string | null;
  recommendedGameId: string | null;
  gameRecommendationExplanation: string | null;
  games: Game[];
  onSelectGame: (gameId: string) => void;
}) {
  const cards = createStorySelectionCards(stories, assets, onSelectStory, recommendedStoryId);
  const isOlderChild = ageBand === "4-7";

  return (
    <SafeAreaView style={[styles.safeArea, isOlderChild && styles.olderSafeArea]}>
      <ScrollView contentContainerStyle={[styles.container, isOlderChild && styles.olderContainer]}>
        <Pressable
          accessibilityLabel="Ebeveyn alanına dön"
          accessibilityRole="button"
          onPress={onRequestParentArea}
          style={styles.parentButton}
        >
          <Text style={styles.parentButtonSymbol}>●</Text>
        </Pressable>
        <View style={[styles.headerCard, isOlderChild && styles.olderHeaderCard]}>
          <Text style={[styles.eyebrow, isOlderChild && styles.olderEyebrow]}>
            {isOlderChild ? "5–7 YAŞ KEŞİF MERKEZİ" : "MİNO İLE OYUN VE HİKÂYE ZAMANI"}
          </Text>
          <Text style={styles.title}>
            {isOlderChild
              ? `Bugün neyi keşfetmek istersin, ${childName}?`
              : `Ne yapmak istersin, ${childName}?`}
          </Text>
          {isOlderChild ? (
            <Text style={styles.olderHeaderHint}>Bir hikâye oku ya da dikkat oyunu seç.</Text>
          ) : null}
        </View>
        <Text style={[styles.sectionTitle, styles.storySectionTitle]}>Hikâyeler</Text>
        <View style={[styles.storyList, styles.storyGrid]}>
          {cards.map((card, index) => (
            <Pressable
              accessibilityLabel={card.accessibilityLabel}
              accessibilityRole="button"
              key={card.storyId}
              onPress={card.onPress}
              style={({ pressed }) => [
                styles.storyCard,
                styles.storyGridCard,
                index % 2 === 1 && styles.storyCardAlternate,
                pressed && styles.storyCardPressed,
              ]}
            >
              {storyCoverImages[card.storyId] ? (
                <View style={styles.storyCover}>
                  <Image
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={card.accessibilityLabel}
                    resizeMode={card.storyId === "mirmir-red-balloon-story" ? "cover" : "contain"}
                    source={storyCoverImages[card.storyId]}
                    style={styles.storyCoverImage}
                  />
                  <Text style={styles.storySceneBadge}>{card.symbol}</Text>
                </View>
              ) : (
                <Text accessibilityLabel={card.accessibilityLabel} style={styles.storySymbol}>
                  {card.symbol}
                </Text>
              )}
              <Text style={styles.storyTitle}>{card.title}</Text>
              {card.recommended && <Text style={styles.recommendedSymbol}>★</Text>}
              <Text style={styles.playLabel}>Başla ›</Text>
            </Pressable>
          ))}
        </View>
        {games.length > 0 ? (
          <View style={styles.gameSection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>
                {isOlderChild ? "Dikkat oyunları" : "Oyunlar"}
              </Text>
              <Text style={styles.optionCount}>{games.length} seçenek</Text>
            </View>
            {gameRecommendationExplanation ? (
              <View style={styles.recommendationBanner}>
                <Text style={styles.recommendationTitle}>Senin için öne çıkan oyun</Text>
                <Text style={styles.recommendationText}>{gameRecommendationExplanation}</Text>
              </View>
            ) : null}
            <View style={[styles.gameList, styles.gameGrid]}>
              {games.map((game) => (
                <Pressable
                  accessibilityLabel={`${game.title} oyununu başlat`}
                  accessibilityRole="button"
                  key={game.id}
                  onPress={() => onSelectGame(game.id)}
                  style={({ pressed }) => [
                    styles.gameCard,
                    styles.gameGridCard,
                    isOlderChild && styles.olderGameCard,
                    game.id === recommendedGameId && styles.recommendedGameCard,
                    pressed && styles.storyCardPressed,
                  ]}
                >
                  {game.mechanic === "sequence_and_place" ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={routineGameIcon}
                      style={styles.gameIcon}
                    />
                  ) : game.mechanic === "classify_and_sort" ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={sortGameIcon}
                      style={styles.gameIcon}
                    />
                  ) : game.mechanic === "emotion_clues" ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={emotionGameIcon}
                      style={[styles.gameIcon, styles.emotionGameIcon]}
                    />
                  ) : game.mechanic === "fish_patterns" ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={fishGameIcon}
                      style={styles.gameIcon}
                    />
                  ) : game.mechanic === "balloon_counting" ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={balloonGameIcon}
                      style={[styles.gameIcon, styles.emotionGameIcon]}
                    />
                  ) : game.mechanic === "mini_challenge" ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={
                        miniGameIcons[game.id as keyof typeof miniGameIcons] ?? defaultMiniGameIcon
                      }
                      style={[styles.gameIcon, styles.emotionGameIcon]}
                    />
                  ) : (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={lightGardenGameIcon}
                      style={styles.gameIcon}
                    />
                  )}
                  <View style={styles.gameCopy}>
                    <Text style={styles.storyTitle}>{game.title}</Text>
                    <Text style={styles.gameDescription}>{game.description}</Text>
                    <Text style={styles.difficultyBadge}>
                      {difficultyLabels[game.difficulty.level]}
                    </Text>
                  </View>
                  {game.id === recommendedGameId ? (
                    <Text style={styles.recommendedGameBadge}>Önerilen</Text>
                  ) : null}
                  <Text style={styles.playLabel}>Oyna ›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF6E8" },
  olderSafeArea: { backgroundColor: "#F3F7FF" },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 },
  olderContainer: { paddingHorizontal: 18, paddingBottom: 40 },
  parentButton: {
    alignSelf: "flex-end",
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
  },
  parentButtonSymbol: { color: "#887867", fontSize: 18 },
  headerCard: {
    padding: 22,
    borderRadius: 26,
    backgroundColor: "#EAF5F2",
  },
  olderHeaderCard: { backgroundColor: "#DDEBFF", borderWidth: 2, borderColor: "#B8D0F5" },
  eyebrow: { marginBottom: 8, color: "#2D8C7C", fontSize: 13, fontWeight: "900" },
  olderEyebrow: { color: "#315E9B" },
  olderHeaderHint: { marginTop: 9, color: "#53687F", fontSize: 15, lineHeight: 21 },
  title: { color: "#463A31", fontSize: 26, fontWeight: "900", lineHeight: 33 },
  storyList: { gap: 14, marginTop: 20 },
  storySectionTitle: { marginTop: 24 },
  storyGrid: { flexDirection: "row", flexWrap: "wrap" },
  gameSection: { gap: 12, marginTop: 28 },
  gameList: { gap: 12 },
  gameGrid: { flexDirection: "row", flexWrap: "wrap" },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#463A31", fontSize: 22, fontWeight: "900" },
  optionCount: { color: "#53687F", fontSize: 13, fontWeight: "800" },
  storyCard: {
    minHeight: 118,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 24,
    backgroundColor: "#FFD9C8",
  },
  storyCardAlternate: { backgroundColor: "#CDEBE4" },
  storyGridCard: {
    width: "48%",
    minHeight: 184,
    flexDirection: "column",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  storyCardPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  storySymbol: { width: 60, fontSize: 48, textAlign: "center" },
  storyCover: {
    width: 86,
    height: 86,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 23,
    backgroundColor: "#FFF8EE",
  },
  storyCoverImage: { width: "100%", height: "100%" },
  storySceneBadge: {
    position: "absolute",
    right: 2,
    bottom: 1,
    fontSize: 24,
    textShadowColor: "#FFFFFF",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyTitle: { flex: 1, color: "#463A31", fontSize: 20, fontWeight: "900", lineHeight: 25 },
  recommendedSymbol: { color: "#D08A19", fontSize: 25 },
  playLabel: { color: "#216D61", fontSize: 16, fontWeight: "900" },
  gameCard: {
    minHeight: 118,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 24,
    backgroundColor: "#E7DDFC",
  },
  gameGridCard: {
    width: "48%",
    minHeight: 260,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 9,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  olderGameCard: { backgroundColor: "#E4EAFB" },
  recommendedGameCard: { borderColor: "#F2B84B", backgroundColor: "#FFF1C9" },
  gameIcon: { width: 78, height: 78, borderRadius: 22, resizeMode: "cover" },
  emotionGameIcon: {
    resizeMode: "contain",
    backgroundColor: "#FFFFFF",
    borderWidth: 5,
    borderColor: "#FFFFFF",
  },
  gameCopy: { flex: 1 },
  gameDescription: { marginTop: 5, color: "#65594F", fontSize: 14, lineHeight: 19 },
  difficultyBadge: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    color: "#315E9B",
    fontSize: 12,
    fontWeight: "900",
  },
  recommendedGameBadge: { color: "#9A6413", fontSize: 12, fontWeight: "900" },
  recommendationBanner: {
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FFF3D4",
  },
  recommendationTitle: { color: "#7B551D", fontSize: 14, fontWeight: "900" },
  recommendationText: { marginTop: 4, color: "#6B5A43", fontSize: 13, lineHeight: 18 },
});
