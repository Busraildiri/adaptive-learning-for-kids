import type { Asset, Story } from "@adaptive/content-schema";

export interface StorySelectionCard {
  storyId: string;
  title: string;
  symbol: string;
  accessibilityLabel: string;
  onPress: () => void;
  recommended: boolean;
}

function readSymbol(asset: Asset | undefined): string {
  if (asset?.type !== "symbol" || !asset.uri.startsWith("emoji:")) return "★";
  return asset.uri.slice("emoji:".length);
}

export function createStorySelectionCards(
  stories: Story[],
  assets: Asset[],
  onSelectStory: (storyId: string) => void,
  recommendedStoryId: string | null = null,
): StorySelectionCard[] {
  const orderedStories = [...stories].sort((left, right) => {
    if (left.id === recommendedStoryId) return -1;
    if (right.id === recommendedStoryId) return 1;
    return 0;
  });
  return orderedStories.map((story) => {
    const sceneAsset = assets.find((asset) => asset.id === story.sceneAssetId);
    return {
      storyId: story.id,
      title: story.title,
      symbol: readSymbol(sceneAsset),
      accessibilityLabel: `${story.title} hikâyesini seç`,
      onPress: () => onSelectStory(story.id),
      recommended: story.id === recommendedStoryId,
    };
  });
}
