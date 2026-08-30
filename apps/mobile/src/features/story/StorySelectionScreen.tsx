import type { AgeBand, Asset, Game, Story } from "@adaptive/content-schema";
import type { PublishedStoryExperience } from "@adaptive/media-schema";
import type { GameProgressMap } from "../../services/gameProgress";
import { DiscoveryScreen } from "./OlderDiscoveryScreen";

interface StorySelectionScreenProps {
  stories: Story[];
  assets: Asset[];
  ageBand: AgeBand;
  catalogSessionSeed: string;
  childName: string;
  initialTab?: "games" | "stories";
  onSelectStory: (storyId: string) => void;
  onRequestParentArea: () => void;
  recommendedStoryId: string | null;
  recommendedGameId: string | null;
  gameRecommendationExplanation: string | null;
  games: Game[];
  gameProgress: GameProgressMap;
  onSelectGame: (gameId: string) => void;
  publishedStories?: PublishedStoryExperience[];
}

export function StorySelectionScreen({
  stories,
  assets,
  ageBand,
  catalogSessionSeed,
  childName,
  initialTab = "games",
  onSelectStory,
  onRequestParentArea,
  recommendedStoryId,
  recommendedGameId,
  games,
  gameProgress,
  onSelectGame,
  publishedStories = [],
}: StorySelectionScreenProps) {
  return (
    <DiscoveryScreen
      ageBand={ageBand}
      assets={assets}
      catalogSessionSeed={catalogSessionSeed}
      childName={childName}
      games={games}
      initialTab={initialTab}
      gameProgress={gameProgress}
      onRequestParentArea={onRequestParentArea}
      onSelectGame={onSelectGame}
      onSelectStory={onSelectStory}
      publishedStories={publishedStories}
      recommendedGameId={recommendedGameId}
      recommendedStoryId={recommendedStoryId}
      stories={stories}
    />
  );
}
