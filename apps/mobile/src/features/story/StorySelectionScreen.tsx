import type { Asset, Game, Story } from "@adaptive/content-schema";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
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
};

export function StorySelectionScreen({
  stories,
  assets,
  childName,
  onSelectStory,
  onRequestParentArea,
  recommendedStoryId,
  games,
  onSelectGame,
}: {
  stories: Story[];
  assets: Asset[];
  childName: string;
  onSelectStory: (storyId: string) => void;
  onRequestParentArea: () => void;
  recommendedStoryId: string | null;
  games: Game[];
  onSelectGame: (gameId: string) => void;
}) {
  const cards = createStorySelectionCards(stories, assets, onSelectStory, recommendedStoryId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          accessibilityLabel="Ebeveyn alanına dön"
          accessibilityRole="button"
          onPress={onRequestParentArea}
          style={styles.parentButton}
        >
          <Text style={styles.parentButtonSymbol}>●</Text>
        </Pressable>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>MİNO İLE OYUN VE HİKÂYE ZAMANI</Text>
          <Text style={styles.title}>Ne yapmak istersin, {childName}?</Text>
        </View>
        <View style={styles.storyList}>
          {cards.map((card, index) => (
            <Pressable
              accessibilityLabel={card.accessibilityLabel}
              accessibilityRole="button"
              key={card.storyId}
              onPress={card.onPress}
              style={({ pressed }) => [
                styles.storyCard,
                index % 2 === 1 && styles.storyCardAlternate,
                pressed && styles.storyCardPressed,
              ]}
            >
              <Text accessibilityLabel={card.accessibilityLabel} style={styles.storySymbol}>
                {card.symbol}
              </Text>
              <Text style={styles.storyTitle}>{card.title}</Text>
              {card.recommended && <Text style={styles.recommendedSymbol}>★</Text>}
              <Text style={styles.playLabel}>Başla ›</Text>
            </Pressable>
          ))}
        </View>
        {games.length > 0 ? (
          <View style={styles.gameSection}>
            <Text style={styles.sectionTitle}>Oyunlar</Text>
            {games.map((game) => (
              <Pressable
                accessibilityLabel={`${game.title} oyununu başlat`}
                accessibilityRole="button"
                key={game.id}
                onPress={() => onSelectGame(game.id)}
                style={({ pressed }) => [styles.gameCard, pressed && styles.storyCardPressed]}
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
                </View>
                <Text style={styles.playLabel}>Oyna ›</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF6E8" },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 },
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
  eyebrow: { marginBottom: 8, color: "#2D8C7C", fontSize: 13, fontWeight: "900" },
  title: { color: "#463A31", fontSize: 26, fontWeight: "900", lineHeight: 33 },
  storyList: { gap: 14, marginTop: 20 },
  gameSection: { gap: 12, marginTop: 28 },
  sectionTitle: { color: "#463A31", fontSize: 22, fontWeight: "900" },
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
  storyCardPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  storySymbol: { width: 60, fontSize: 48, textAlign: "center" },
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
  gameIcon: { width: 78, height: 78, borderRadius: 22, resizeMode: "cover" },
  emotionGameIcon: {
    resizeMode: "contain",
    backgroundColor: "#FFFFFF",
    borderWidth: 5,
    borderColor: "#FFFFFF",
  },
  gameCopy: { flex: 1 },
  gameDescription: { marginTop: 5, color: "#65594F", fontSize: 14, lineHeight: 19 },
});
