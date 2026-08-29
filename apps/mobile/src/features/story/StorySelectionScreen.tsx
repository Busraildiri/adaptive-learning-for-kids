import type { AgeBand, Asset, Game, Story } from "@adaptive/content-schema";
import { DiscoveryScreen } from "./OlderDiscoveryScreen";

interface StorySelectionScreenProps {
  stories: Story[];
  assets: Asset[];
  ageBand: AgeBand;
  catalogSessionSeed: string;
  childName: string;
  onSelectStory: (storyId: string) => void;
  onRequestParentArea: () => void;
  recommendedStoryId: string | null;
  recommendedGameId: string | null;
  gameRecommendationExplanation: string | null;
  games: Game[];
  onSelectGame: (gameId: string) => void;
}

export function StorySelectionScreen({
  stories,
  assets,
  ageBand,
  catalogSessionSeed,
  childName,
  onSelectStory,
  onRequestParentArea,
  recommendedStoryId,
  recommendedGameId,
  games,
  onSelectGame,
}: StorySelectionScreenProps) {
  return (
    <DiscoveryScreen
      ageBand={ageBand}
      assets={assets}
      catalogSessionSeed={catalogSessionSeed}
      childName={childName}
      games={games}
      onRequestParentArea={onRequestParentArea}
      onSelectGame={onSelectGame}
      onSelectStory={onSelectStory}
      recommendedGameId={recommendedGameId}
      recommendedStoryId={recommendedStoryId}
      stories={stories}
    />
  );
}
