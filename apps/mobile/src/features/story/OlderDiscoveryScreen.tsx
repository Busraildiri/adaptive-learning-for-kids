import type { AgeBand, Asset, Game, Story } from "@adaptive/content-schema";
import type { PublishedStoryExperience } from "@adaptive/media-schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  CONTENT_PAGE_SIZE,
  createSessionOrder,
  getContentPage,
  getContentPageCount,
  getOlderGameWorld,
  groupOlderGames,
  type OlderGameWorldId,
} from "./olderGameCategories";
import { createPublishedStorySelectionCards } from "./publishedStorySelection";
import { createStorySelectionCards } from "./storySelection";

const minoHappy = require("../../../assets/characters/mino-happy.png");
const fishGameIcon = require("../../../assets/game/home/fish-patterns.png");
const routineGameIcon = require("../../../assets/game/home/morning-routine.png");
const sortGameIcon = require("../../../assets/game/home/sort-basket.png");
const emotionGameIcon = require("../../../assets/game/emotion/happy-rabbit-v2.png");
const balloonGameIcon = require("../../../assets/game/balloon/balloon-pink-v1.png");
const defaultMiniGameIcon = require("../../../assets/game/home/light-path.png");
const lightGardenGameIcon = require("../../../assets/game/home/light-garden.png");
const soundRhythmGameIcon = require("../../../assets/game/home/sound-rhythm.png");
const missingBlocksGameIcon = require("../../../assets/game/home/missing-blocks.png");
const bigSmallGameIcon = require("../../../assets/game/home/big-small-acorns.png");
const spatialGameIcon = require("../../../assets/game/home/spatial-crate.png");

const gameArtworkById: Record<string, ImageSourcePropType> = {
  "color-lights-001": lightGardenGameIcon,
  "nino-sound-rhythm-001": soundRhythmGameIcon,
  "maya-morning-order-001": routineGameIcon,
  "riko-where-001": spatialGameIcon,
  "zuzu-missing-piece-001": missingBlocksGameIcon,
  "kiki-big-small-shop-001": bigSmallGameIcon,
  "piko-pattern-train-001": fishGameIcon,
  "mavi-shadow-pairs-001": missingBlocksGameIcon,
  "lumi-sound-hunt-001": soundRhythmGameIcon,
  "toko-little-map-001": spatialGameIcon,
};

const storyCoverImages: Record<string, ImageSourcePropType> = {
  "mino-balloon-story": require("../../../assets/characters/mino-happy.png"),
  "mino-block-tower-story": require("../../../assets/characters/mino-sad-v2.png"),
  "mino-friend-goodbye-story": require("../../../assets/characters/mino-happy.png"),
  "mirmir-red-balloon-story": require("../../../assets/characters/mirmir-happy.jpg"),
  "mino-lost-toy-story": require("../../../assets/characters/mino-sad-v2.png"),
};

type WorldTheme = {
  id: OlderGameWorldId;
  title: string;
  narration: string;
  subtitle: string;
  background: string;
  softBackground: string;
  accent: string;
  icon: "robot-happy-outline" | "fish" | "heart-multiple" | "music-note-eighth";
  decorations:
    | ["cog", "diamond-stone"]
    | ["waves", "star-four-points"]
    | ["home-heart", "emoticon-happy-outline"]
    | ["ear-hearing", "hand-pointing-up"];
};

const worldThemes: WorldTheme[] = [
  {
    id: "workshop",
    title: "Mucit Atölyesi",
    narration: "Mucit Atölyesi; yap, say ve çalıştır!",
    subtitle: "Yap · Say · Çalıştır",
    background: "#BDE8F6",
    softBackground: "#E8F8FC",
    accent: "#168FBA",
    icon: "robot-happy-outline",
    decorations: ["cog", "diamond-stone"],
  },
  {
    id: "pattern_sea",
    title: "Desen ve Hafıza Denizi",
    narration: "Desen ve Hafıza Denizi; bak, hatırla ve tamamla!",
    subtitle: "Bak · Hatırla · Tamamla",
    background: "#A9E2D2",
    softBackground: "#E4F7F1",
    accent: "#218E78",
    icon: "fish",
    decorations: ["waves", "star-four-points"],
  },
  {
    id: "feelings",
    title: "Duygu Mahallesi",
    narration: "Duygu Mahallesi; yüzlere bak ve duyguları keşfet!",
    subtitle: "Bak · Hisset · Anlat",
    background: "#E4CEFA",
    softBackground: "#F4EBFC",
    accent: "#7650A8",
    icon: "heart-multiple",
    decorations: ["home-heart", "emoticon-happy-outline"],
  },
  {
    id: "movement",
    title: "Ses ve Hareket Sahnesi",
    narration: "Ses ve Hareket Sahnesi; dinle ve harekete geç!",
    subtitle: "Dinle · Bekle · Hareket et",
    background: "#FFD9A8",
    softBackground: "#FFF2DF",
    accent: "#D87328",
    icon: "music-note-eighth",
    decorations: ["ear-hearing", "hand-pointing-up"],
  },
];

function getWorldThemes(ageBand: AgeBand): WorldTheme[] {
  if (ageBand === "4-7") return worldThemes;
  return worldThemes.map((theme) => {
    if (theme.id === "workshop") {
      return {
        ...theme,
        title: "Minik Oyun Atölyesi",
        narration: "Minik Oyun Atölyesi; dokun, say ve sırala!",
        subtitle: "Dokun · Say · Sırala",
      };
    }
    if (theme.id === "pattern_sea") {
      return {
        ...theme,
        title: "Desen ve Eşleştirme Denizi",
        narration: "Desen ve Eşleştirme Denizi; bak, bul ve eşleştir!",
        subtitle: "Bak · Bul · Eşleştir",
      };
    }
    return theme;
  });
}

function BackgroundDecorations() {
  return (
    <View pointerEvents="none" style={styles.decorations}>
      <View style={[styles.bubble, styles.bubblePink]} />
      <View style={[styles.bubble, styles.bubbleBlue]} />
      <View style={[styles.bubble, styles.bubbleYellow]} />
      <MaterialCommunityIcons
        color="rgba(238,181,49,0.28)"
        name="star-four-points"
        size={25}
        style={styles.starOne}
      />
      <MaterialCommunityIcons
        color="rgba(238,181,49,0.22)"
        name="star-four-points"
        size={18}
        style={styles.starTwo}
      />
    </View>
  );
}

function RobotArt({ size = 86 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="Gülümseyen robot Momo"
      accessible
      style={[styles.robotArt, { width: size, height: size }]}
    >
      <View style={styles.robotAntenna} />
      <View style={styles.robotAntennaDot} />
      <View style={styles.robotFace}>
        <View style={styles.robotEyes}>
          <View style={styles.robotEye} />
          <View style={styles.robotEye} />
        </View>
        <View style={styles.robotSmile} />
      </View>
    </View>
  );
}

function GameArtwork({ game, large = false }: { game: Game; large?: boolean }) {
  const size = large ? 112 : 78;
  if (game.mechanic === "momo_workshop") return <RobotArt size={size} />;
  const source =
    gameArtworkById[game.id] ??
    (game.mechanic === "fish_patterns"
      ? fishGameIcon
      : game.mechanic === "sequence_and_place"
        ? routineGameIcon
        : game.mechanic === "classify_and_sort"
          ? sortGameIcon
          : game.mechanic === "emotion_clues"
            ? emotionGameIcon
            : game.mechanic === "balloon_counting"
              ? balloonGameIcon
              : defaultMiniGameIcon);
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={source}
      style={{ width: size, height: size, resizeMode: "contain" }}
    />
  );
}

function WorldBanner({ theme }: { theme: WorldTheme }) {
  const speak = () => {
    void Speech.stop();
    Speech.speak(theme.narration, { language: "tr-TR", rate: 0.86 });
  };
  return (
    <Pressable
      accessibilityHint="Kategori adını dinlemek için dokun"
      accessibilityLabel={theme.title}
      accessibilityRole="button"
      onPress={speak}
      style={({ pressed }) => [
        styles.worldBanner,
        { backgroundColor: theme.background },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.worldIconBubble, { backgroundColor: theme.softBackground }]}>
        <MaterialCommunityIcons color={theme.accent} name={theme.icon} size={50} />
      </View>
      <View style={styles.worldCopy}>
        <Text style={styles.worldTitle}>{theme.title}</Text>
        <Text style={styles.worldSubtitle}>{theme.subtitle}</Text>
      </View>
      <View style={styles.worldScene}>
        <MaterialCommunityIcons color={theme.accent} name={theme.decorations[0]} size={25} />
        <MaterialCommunityIcons
          color="#F4B72F"
          name={theme.decorations[1]}
          size={22}
          style={styles.worldSceneSecond}
        />
      </View>
      <View style={[styles.listenPill, { backgroundColor: theme.accent }]}>
        <MaterialCommunityIcons color="#FFFFFF" name="volume-high" size={21} />
      </View>
    </Pressable>
  );
}

function FeaturedGameCard({
  game,
  theme,
  recommended,
  onPlay,
}: {
  game: Game;
  theme: WorldTheme;
  recommended: boolean;
  onPlay: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${game.title} oyununu başlat`}
      accessibilityRole="button"
      onPress={onPlay}
      style={({ pressed }) => [
        styles.featuredCard,
        { backgroundColor: theme.softBackground },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.featuredArt, { backgroundColor: theme.background }]}>
        <MaterialCommunityIcons
          color={`${theme.accent}55`}
          name={theme.decorations[0]}
          size={27}
          style={styles.featuredDecorOne}
        />
        <MaterialCommunityIcons
          color="#F4B72F"
          name={theme.decorations[1]}
          size={23}
          style={styles.featuredDecorTwo}
        />
        <GameArtwork game={game} large />
      </View>
      <View style={styles.featuredCopy}>
        {recommended ? (
          <View style={[styles.recommendedPill, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons color="#FFFFFF" name="star-four-points" size={14} />
            <Text style={styles.recommendedPillText}>Önerilen</Text>
          </View>
        ) : game.mechanic === "momo_workshop" ? (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>YENİ</Text>
          </View>
        ) : null}
        <Text style={styles.featuredTitle}>{game.title}</Text>
        <View style={styles.actionHintRow}>
          {game.skillTags.slice(0, 3).map((skill) => (
            <View key={skill} style={[styles.actionHintDot, { backgroundColor: theme.accent }]} />
          ))}
        </View>
        <View style={[styles.playButton, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons color="#FFFFFF" name="play" size={25} />
          <Text style={styles.playButtonText}>Oyna</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SmallGameCard({
  game,
  theme,
  recommended,
  onPlay,
}: {
  game: Game;
  theme: WorldTheme;
  recommended: boolean;
  onPlay: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${game.title} oyununu başlat`}
      accessibilityRole="button"
      onPress={onPlay}
      style={({ pressed }) => [
        styles.smallGameCard,
        { backgroundColor: theme.softBackground },
        pressed && styles.pressed,
      ]}
    >
      {recommended ? (
        <View style={[styles.smallRecommended, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons color="#FFFFFF" name="star" size={14} />
        </View>
      ) : null}
      <View style={[styles.smallGameArt, { backgroundColor: theme.background }]}>
        <GameArtwork game={game} />
      </View>
      <Text numberOfLines={2} style={styles.smallGameTitle}>
        {game.title}
      </Text>
      <View style={[styles.smallPlayButton, { backgroundColor: theme.accent }]}>
        <MaterialCommunityIcons color="#FFFFFF" name="play" size={20} />
        <Text style={styles.smallPlayText}>Oyna</Text>
      </View>
    </Pressable>
  );
}

function MoreContentButton({
  accent,
  label,
  narration,
  onPress,
  page,
  pageCount,
}: {
  accent: string;
  label: string;
  narration: string;
  onPress: () => void;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const normalizedPage = page % pageCount;
  return (
    <View style={styles.moreContentArea}>
      <Pressable
        accessibilityHint="Sonraki dört resmi gösterir"
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => {
          void Speech.stop();
          Speech.speak(narration, { language: "tr-TR", rate: 0.86 });
          onPress();
        }}
        style={({ pressed }) => [
          styles.moreContentButton,
          { borderColor: `${accent}44` },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.moreTileSymbol}>
          <View
            style={[styles.moreTile, styles.moreTileBack, { backgroundColor: `${accent}42` }]}
          />
          <View
            style={[styles.moreTile, styles.moreTileMiddle, { backgroundColor: `${accent}72` }]}
          />
          <View style={[styles.moreTile, styles.moreTileFront, { backgroundColor: accent }]} />
        </View>
        <Text style={[styles.moreContentText, { color: accent }]}>{label}</Text>
        <MaterialCommunityIcons color={accent} name="arrow-right-circle" size={32} />
      </Pressable>
      <View accessibilityLabel={`${normalizedPage + 1}. sayfa`} style={styles.pageDots}>
        {Array.from({ length: pageCount }, (_, index) => (
          <View
            key={index}
            style={[
              styles.pageDot,
              { backgroundColor: index === normalizedPage ? accent : `${accent}35` },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function GameWorldSection({
  games,
  theme,
  recommendedGameId,
  onSelectGame,
}: {
  games: Game[];
  theme: WorldTheme;
  recommendedGameId: string | null;
  onSelectGame: (gameId: string) => void;
}) {
  const [page, setPage] = useState(0);
  const pageCount = getContentPageCount(games.length);
  const visibleGames = getContentPage(games, page);
  const featured = visibleGames[0];
  if (!featured) return null;
  const remaining = visibleGames.slice(1);
  const trailingGame = remaining.length % 2 === 1 ? remaining.at(-1) : undefined;
  const pairedGames = trailingGame ? remaining.slice(0, -1) : remaining;
  return (
    <View style={styles.worldSection}>
      <WorldBanner theme={theme} />
      <FeaturedGameCard
        game={featured}
        onPlay={() => onSelectGame(featured.id)}
        recommended={featured.id === recommendedGameId}
        theme={theme}
      />
      {pairedGames.length > 0 ? (
        <View style={styles.smallGameGrid}>
          {pairedGames.map((game) => (
            <SmallGameCard
              game={game}
              key={game.id}
              onPlay={() => onSelectGame(game.id)}
              recommended={game.id === recommendedGameId}
              theme={theme}
            />
          ))}
        </View>
      ) : null}
      {trailingGame ? (
        <FeaturedGameCard
          game={trailingGame}
          onPlay={() => onSelectGame(trailingGame.id)}
          recommended={trailingGame.id === recommendedGameId}
          theme={theme}
        />
      ) : null}
      <MoreContentButton
        accent={theme.accent}
        label="Başka oyunlar"
        narration="Başka oyunlar geliyor!"
        onPress={() => setPage((current) => (current + 1) % pageCount)}
        page={page}
        pageCount={pageCount}
      />
    </View>
  );
}

const youngerGuidance = {
  games: "Şimdi oyunlar karşında. Oynamak istediğin resme dokun.",
  stories: "Şimdi hikâyeler dünyasındayız. Dinlemek istediğin resme dokun.",
} as const;

function GuidedContextCard({
  mode,
  onReplay,
}: {
  mode: "games" | "stories";
  onReplay: () => void;
}) {
  const isGames = mode === "games";
  const accent = isGames ? "#218E78" : "#DF6948";
  return (
    <View
      accessibilityLabel={youngerGuidance[mode]}
      style={[styles.guidedContextCard, { backgroundColor: isGames ? "#DDF5EE" : "#FFE5D6" }]}
    >
      <View style={styles.guidedScene}>
        {isGames ? (
          <>
            <MaterialCommunityIcons color="#6546B3" name="gamepad-variant" size={48} />
            <MaterialCommunityIcons
              color="#F1B72E"
              name="star-four-points"
              size={22}
              style={styles.guidedSceneStar}
            />
          </>
        ) : (
          <>
            <MaterialCommunityIcons color={accent} name="book-open-page-variant" size={50} />
            <Image source={minoHappy} style={styles.guidedMino} />
          </>
        )}
      </View>
      <View style={styles.guidedCopy}>
        <Text style={styles.guidedTitle}>
          {isGames ? "Oyunlar karşında!" : "Hikâyeler dünyasındayız!"}
        </Text>
        <View style={styles.guidedGestureRow}>
          <MaterialCommunityIcons color={accent} name="gesture-tap" size={25} />
          <Text style={styles.guidedHint}>Bir resme dokun</Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel="Yönergeyi yeniden dinle"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onReplay}
        style={[styles.guidanceReplay, { backgroundColor: accent }]}
      >
        <MaterialCommunityIcons color="#FFFFFF" name="volume-high" size={27} />
      </Pressable>
    </View>
  );
}

function StoryCard({
  card,
  index,
}: {
  card: ReturnType<typeof createStorySelectionCards>[number];
  index: number;
}) {
  const backgrounds = ["#FFE0CF", "#D6F0E9", "#E9DDFC", "#FFF0B8"];
  const accents = ["#DF6948", "#248D7B", "#7551AE", "#D28A18"];
  const backgroundColor = backgrounds[index % backgrounds.length];
  const accent = accents[index % accents.length];
  return (
    <Pressable
      accessibilityLabel={card.accessibilityLabel}
      accessibilityRole="button"
      onPress={card.onPress}
      style={({ pressed }) => [styles.storyCard, { backgroundColor }, pressed && styles.pressed]}
    >
      <View style={[styles.storyArt, { backgroundColor: `${accent}24` }]}>
        {storyCoverImages[card.storyId] ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode={card.storyId === "mirmir-red-balloon-story" ? "cover" : "contain"}
            source={storyCoverImages[card.storyId]}
            style={styles.storyImage}
          />
        ) : (
          <Text style={styles.storySymbol}>{card.symbol}</Text>
        )}
        {card.recommended ? (
          <View style={[styles.storyBadge, { backgroundColor: accent }]}>
            <MaterialCommunityIcons color="#FFFFFF" name="star" size={14} />
          </View>
        ) : null}
      </View>
      <View style={styles.storyBottom}>
        <Text numberOfLines={2} style={styles.storyTitle}>
          {card.title}
        </Text>
        <View style={[styles.storyPlay, { backgroundColor: accent }]}>
          <MaterialCommunityIcons color="#FFFFFF" name="play" size={22} />
        </View>
      </View>
    </Pressable>
  );
}

function BottomNavigation({
  ageBand,
  tab,
  onChange,
}: {
  ageBand: AgeBand;
  tab: "games" | "stories";
  onChange: (tab: "games" | "stories") => void;
}) {
  return (
    <View style={styles.bottomNavigation}>
      <Pressable
        accessibilityLabel="Oyunlar"
        accessibilityRole="tab"
        accessibilityState={{ selected: tab === "games" }}
        onPress={() => onChange("games")}
        style={[styles.navButton, tab === "games" && styles.navGamesActive]}
      >
        <MaterialCommunityIcons
          color={tab === "games" ? "#6546B3" : "#A7A4A0"}
          name={ageBand === "2-4" ? "puzzle" : "gamepad-variant"}
          size={30}
        />
        <Text style={[styles.navLabel, tab === "games" && styles.navGamesLabel]}>Oyunlar</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Hikâyeler"
        accessibilityRole="tab"
        accessibilityState={{ selected: tab === "stories" }}
        onPress={() => onChange("stories")}
        style={[styles.navButton, tab === "stories" && styles.navStoriesActive]}
      >
        <View style={styles.navStorySymbol}>
          <Image source={minoHappy} style={styles.navMino} />
          {ageBand === "2-4" ? (
            <View style={styles.navBookBadge}>
              <MaterialCommunityIcons color="#DF5C38" name="book-open-page-variant" size={15} />
            </View>
          ) : null}
        </View>
        <Text style={[styles.navLabel, tab === "stories" && styles.navStoriesLabel]}>
          {ageBand === "2-4" ? "Hikâyeler" : "Mino"}
        </Text>
      </Pressable>
    </View>
  );
}

export function DiscoveryScreen({
  ageBand,
  assets,
  catalogSessionSeed,
  childName,
  games,
  onRequestParentArea,
  onSelectGame,
  onSelectStory,
  publishedStories,
  recommendedGameId,
  recommendedStoryId,
  stories,
}: {
  ageBand: AgeBand;
  assets: Asset[];
  catalogSessionSeed: string;
  childName: string;
  games: Game[];
  onRequestParentArea: () => void;
  onSelectGame: (gameId: string) => void;
  onSelectStory: (storyId: string) => void;
  publishedStories: PublishedStoryExperience[];
  recommendedGameId: string | null;
  recommendedStoryId: string | null;
  stories: Story[];
}) {
  const [tab, setTab] = useState<"games" | "stories">("games");
  const [youngerGamePage, setYoungerGamePage] = useState(0);
  const [storyPage, setStoryPage] = useState(0);
  const themes = useMemo(() => getWorldThemes(ageBand), [ageBand]);
  const themeById = useMemo(
    () => new Map(themes.map((theme) => [theme.id, theme] as const)),
    [themes],
  );
  const handleSelectGame = useCallback(
    (gameId: string) => {
      void Speech.stop();
      onSelectGame(gameId);
    },
    [onSelectGame],
  );
  const handleSelectStory = useCallback(
    (storyId: string) => {
      void Speech.stop();
      onSelectStory(storyId);
    },
    [onSelectStory],
  );
  const orderedGames = useMemo(
    () => createSessionOrder(games, (game) => game.id, recommendedGameId, catalogSessionSeed),
    [catalogSessionSeed, games, recommendedGameId],
  );
  const groups = useMemo(() => groupOlderGames(orderedGames), [orderedGames]);
  const bundledStoryIds = useMemo(() => new Set(stories.map((story) => story.id)), [stories]);
  const bundledCards = useMemo(
    () => createStorySelectionCards(stories, assets, handleSelectStory, recommendedStoryId),
    [assets, handleSelectStory, recommendedStoryId, stories],
  );
  const publishedCards = useMemo(
    () =>
      createPublishedStorySelectionCards(publishedStories, handleSelectStory).filter(
        (card) => !bundledStoryIds.has(card.storyId),
      ),
    [bundledStoryIds, handleSelectStory, publishedStories],
  );
  const cards = useMemo(() => [...bundledCards, ...publishedCards], [bundledCards, publishedCards]);
  const orderedCards = useMemo(
    () =>
      createSessionOrder(
        cards,
        (card) => card.storyId,
        recommendedStoryId,
        `${catalogSessionSeed}:stories`,
      ),
    [cards, catalogSessionSeed, recommendedStoryId],
  );
  const youngerGamePageCount = getContentPageCount(orderedGames.length);
  const visibleYoungerGames = getContentPage(orderedGames, youngerGamePage);
  const storyPageCount = getContentPageCount(orderedCards.length);
  const visibleStoryCards = getContentPage(orderedCards, storyPage);
  const replayGuidance = useCallback(() => {
    void Speech.stop().then(() => {
      Speech.speak(youngerGuidance[tab], { language: "tr-TR", rate: 0.82 });
    });
  }, [tab]);

  useEffect(() => {
    if (ageBand !== "2-4") return;
    const timer = setTimeout(replayGuidance, 350);
    return () => {
      clearTimeout(timer);
      void Speech.stop();
    };
  }, [ageBand, replayGuidance]);
  useEffect(() => () => void Speech.stop(), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackgroundDecorations />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <View style={styles.profilePill}>
              <MaterialCommunityIcons
                color={ageBand === "4-7" ? "#6546B3" : "#218E78"}
                name={ageBand === "4-7" ? "rocket-launch" : "weather-sunny"}
                size={16}
              />
              <Text
                style={[
                  styles.profilePillText,
                  ageBand === "4-7" ? styles.olderPillText : styles.youngerPillText,
                ]}
              >
                {ageBand === "4-7" ? "Büyük Mucitler" : "Minik Kaşifler"}
              </Text>
            </View>
            <View style={styles.ageRow}>
              <Text style={styles.headerTitle}>
                {tab === "games" ? "Oyunlar" : ageBand === "2-4" ? "Hikâyeler" : "Mino’yla Keşfet"}
              </Text>
              <MaterialCommunityIcons color="#F1B72E" name="star-four-points" size={34} />
            </View>
            <Text style={styles.headerSubtitle}>
              {tab === "games"
                ? ageBand === "4-7"
                  ? `Hangi dünyayı keşfetmek istersin, ${childName}?`
                  : `Hangi oyuna dokunmak istersin, ${childName}?`
                : "Bir hikâye seç ve Mino’ya katıl!"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Ebeveyn alanına dön"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRequestParentArea}
            style={styles.parentButton}
          >
            <MaterialCommunityIcons color="#5C554F" name="account-lock" size={24} />
          </Pressable>
        </View>

        {tab === "games" ? (
          ageBand === "4-7" ? (
            <View style={styles.worldList}>
              {themes.flatMap((theme) => {
                const worldGames = groups.get(theme.id) ?? [];
                return worldGames.length > 0
                  ? [
                      <GameWorldSection
                        games={worldGames}
                        key={`${theme.id}:${catalogSessionSeed}`}
                        onSelectGame={handleSelectGame}
                        recommendedGameId={recommendedGameId}
                        theme={theme}
                      />,
                    ]
                  : [];
              })}
            </View>
          ) : (
            <View style={styles.youngerContent}>
              <GuidedContextCard mode="games" onReplay={replayGuidance} />
              <View style={styles.smallGameGrid}>
                {visibleYoungerGames.map((game) => {
                  const theme = themeById.get(getOlderGameWorld(game)) ?? themes[0];
                  return (
                    <SmallGameCard
                      game={game}
                      key={game.id}
                      onPlay={() => handleSelectGame(game.id)}
                      recommended={game.id === recommendedGameId}
                      theme={theme}
                    />
                  );
                })}
              </View>
              <MoreContentButton
                accent="#218E78"
                label="Başka oyunlar"
                narration="Başka oyunlar geliyor!"
                onPress={() =>
                  setYoungerGamePage((current) => (current + 1) % youngerGamePageCount)
                }
                page={youngerGamePage}
                pageCount={youngerGamePageCount}
              />
            </View>
          )
        ) : (
          <View>
            {ageBand === "2-4" ? (
              <View style={styles.youngerStoryIntro}>
                <GuidedContextCard mode="stories" onReplay={replayGuidance} />
              </View>
            ) : (
              <View style={styles.minoHero}>
                <View style={styles.minoHalo} />
                <MaterialCommunityIcons
                  color="#F4B72F"
                  name="star-four-points"
                  size={26}
                  style={styles.minoStar}
                />
                <Image source={minoHappy} style={styles.minoHeroImage} />
              </View>
            )}
            <View style={styles.storyGrid}>
              {visibleStoryCards.map((card, index) => (
                <StoryCard card={card} index={index} key={card.storyId} />
              ))}
            </View>
            <MoreContentButton
              accent="#DF6948"
              label="Başka hikâyeler"
              narration="Başka hikâyeler geliyor!"
              onPress={() => setStoryPage((current) => (current + 1) % storyPageCount)}
              page={storyPage}
              pageCount={storyPageCount}
            />
          </View>
        )}
      </ScrollView>
      <BottomNavigation ageBand={ageBand} onChange={setTab} tab={tab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF8F0" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 128 },
  decorations: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  bubble: { position: "absolute", borderRadius: 50, opacity: 0.22 },
  bubblePink: { top: 86, left: 21, width: 28, height: 28, backgroundColor: "#F7A8B9" },
  bubbleBlue: { top: 340, right: 12, width: 24, height: 24, backgroundColor: "#9CDDF2" },
  bubbleYellow: { bottom: 160, left: 14, width: 20, height: 20, backgroundColor: "#F7D879" },
  starOne: { position: "absolute", top: 38, right: 34 },
  starTwo: { position: "absolute", top: 198, left: 8 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1 },
  profilePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  profilePillText: { fontSize: 11, fontWeight: "900" },
  olderPillText: { color: "#6546B3" },
  youngerPillText: { color: "#218E78" },
  ageRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  headerTitle: { color: "#273342", fontSize: 34, fontWeight: "900", lineHeight: 42 },
  headerSubtitle: {
    marginTop: 3,
    color: "#8C8985",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  parentButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#6A5F55",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
  },
  worldList: { gap: 28, marginTop: 24 },
  worldSection: { gap: 12 },
  worldBanner: {
    minHeight: 105,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    padding: 13,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    borderRadius: 28,
  },
  worldIconBubble: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  worldCopy: { zIndex: 2, flex: 1, marginLeft: 12 },
  worldTitle: { color: "#273342", fontSize: 20, fontWeight: "900", lineHeight: 25 },
  worldSubtitle: { marginTop: 4, color: "#58636B", fontSize: 12, fontWeight: "800" },
  worldScene: { position: "absolute", right: 47, top: 8 },
  worldSceneSecond: { marginTop: 26, marginLeft: 18 },
  listenPill: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  featuredCard: {
    minHeight: 175,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 28,
    shadowColor: "#655B53",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
  },
  featuredArt: {
    position: "relative",
    width: "43%",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredDecorOne: { position: "absolute", top: 11, left: 10 },
  featuredDecorTwo: { position: "absolute", right: 9, bottom: 11 },
  featuredCopy: { flex: 1, alignItems: "flex-start", justifyContent: "center", padding: 15 },
  recommendedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 13,
  },
  recommendedPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  newPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 11,
    backgroundColor: "#ED5D3A",
  },
  newPillText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  featuredTitle: {
    marginTop: 7,
    color: "#273342",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 24,
  },
  actionHintRow: { flexDirection: "row", gap: 5, marginTop: 8 },
  actionHintDot: { width: 8, height: 8, borderRadius: 4 },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  playButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  smallGameGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  youngerContent: { gap: 16, marginTop: 20 },
  youngerStoryIntro: { marginTop: 20 },
  guidedContextCard: {
    minHeight: 128,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    padding: 13,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 28,
  },
  guidedScene: {
    position: "relative",
    width: 78,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  guidedSceneStar: { position: "absolute", top: 5, right: 5 },
  guidedMino: { position: "absolute", right: -3, bottom: -8, width: 50, height: 58 },
  guidedCopy: { flex: 1, gap: 8, paddingHorizontal: 12 },
  guidedTitle: { color: "#273342", fontSize: 18, fontWeight: "900", lineHeight: 23 },
  guidedGestureRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  guidedHint: { color: "#5F6669", fontSize: 13, fontWeight: "800" },
  guidanceReplay: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
  },
  smallGameCard: {
    position: "relative",
    width: "48%",
    minHeight: 235,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 25,
    shadowColor: "#655B53",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
  },
  smallRecommended: {
    position: "absolute",
    zIndex: 3,
    top: 9,
    right: 9,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  smallGameArt: { height: 126, alignItems: "center", justifyContent: "center" },
  smallGameTitle: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingTop: 9,
    color: "#273342",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
    textAlign: "center",
  },
  smallPlayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginHorizontal: 10,
    marginBottom: 11,
    paddingVertical: 8,
    borderRadius: 14,
  },
  smallPlayText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  moreContentArea: { alignItems: "center", gap: 8, marginTop: 2 },
  moreContentButton: {
    minWidth: 208,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderWidth: 3,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  moreTileSymbol: { width: 40, height: 36, justifyContent: "center" },
  moreTile: {
    position: "absolute",
    width: 23,
    height: 27,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 7,
  },
  moreTileBack: { left: 0, transform: [{ rotate: "-9deg" }] },
  moreTileMiddle: { left: 8 },
  moreTileFront: { right: 0, transform: [{ rotate: "9deg" }] },
  moreContentText: { fontSize: 14, fontWeight: "900" },
  pageDots: { flexDirection: "row", alignItems: "center", gap: 6 },
  pageDot: { width: 9, height: 9, borderRadius: 5 },
  robotArt: { alignItems: "center", justifyContent: "flex-end" },
  robotFace: {
    width: "78%",
    height: "65%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#FFFFFF",
    borderRadius: 25,
    backgroundColor: "#54B9B0",
  },
  robotAntenna: { position: "absolute", top: 4, width: 5, height: 20, backgroundColor: "#3A8B86" },
  robotAntennaDot: {
    position: "absolute",
    zIndex: 2,
    top: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#F3C64E",
  },
  robotEyes: { flexDirection: "row", gap: 17 },
  robotEye: { width: 10, height: 15, borderRadius: 6, backgroundColor: "#24383F" },
  robotSmile: {
    width: 27,
    height: 13,
    marginTop: 7,
    borderBottomWidth: 4,
    borderColor: "#24383F",
    borderRadius: 14,
  },
  storyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 },
  storyCard: {
    width: "48%",
    minHeight: 238,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 26,
    shadowColor: "#655B53",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.11,
    shadowRadius: 8,
  },
  storyArt: { height: 145, alignItems: "center", justifyContent: "center" },
  storyImage: { width: 115, height: 125 },
  storySymbol: { fontSize: 62 },
  storyBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 29,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  storyBottom: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 11,
    backgroundColor: "rgba(255,255,255,0.44)",
  },
  storyTitle: { flex: 1, color: "#273342", fontSize: 14, fontWeight: "900", lineHeight: 18 },
  storyPlay: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  minoHero: { height: 205, alignItems: "center", justifyContent: "center", marginTop: 7 },
  minoHalo: {
    position: "absolute",
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: "#FFE6D5",
  },
  minoHeroImage: { width: 165, height: 185, resizeMode: "contain" },
  minoStar: { position: "absolute", zIndex: 2, top: 18, right: "22%" },
  bottomNavigation: {
    position: "absolute",
    right: 16,
    bottom: 10,
    left: 16,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    shadowColor: "#4E4944",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 13,
  },
  navButton: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 2 },
  navGamesActive: { backgroundColor: "#EEE8FF" },
  navStoriesActive: { backgroundColor: "#FFE8D8" },
  navStorySymbol: { position: "relative", width: 40, height: 36, alignItems: "center" },
  navMino: { width: 34, height: 34, resizeMode: "contain" },
  navBookBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 11,
    backgroundColor: "#FFE8D8",
  },
  navLabel: { color: "#A7A4A0", fontSize: 12, fontWeight: "900" },
  navGamesLabel: { color: "#6546B3" },
  navStoriesLabel: { color: "#DF5C38" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
