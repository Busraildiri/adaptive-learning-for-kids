import type { Asset, Story } from "@adaptive/content-schema";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { createStorySelectionCards } from "./storySelection";

export function StorySelectionScreen({
  stories,
  assets,
  childName,
  onSelectStory,
  onRequestParentArea,
  recommendedStoryId,
}: {
  stories: Story[];
  assets: Asset[];
  childName: string;
  onSelectStory: (storyId: string) => void;
  onRequestParentArea: () => void;
  recommendedStoryId: string | null;
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
          <Text style={styles.eyebrow}>MİNO İLE HİKÂYE ZAMANI</Text>
          <Text style={styles.title}>Hangisini dinlemek istersin, {childName}?</Text>
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
});
