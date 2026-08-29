import type { PublishedStoryExperience } from "@adaptive/media-schema";

export interface PublishedStorySelectionCard {
  storyId: string;
  title: string;
  symbol: string;
  accessibilityLabel: string;
  onPress: () => void;
}

const DEFAULT_SYMBOL = "🎬";

export function createPublishedStorySelectionCards(
  experiences: PublishedStoryExperience[],
  onSelectStory: (storyId: string) => void,
): PublishedStorySelectionCard[] {
  return experiences.map((experience) => ({
    storyId: experience.storyId,
    title: experience.title,
    symbol: DEFAULT_SYMBOL,
    accessibilityLabel: `${experience.title} hikâyesini seç`,
    onPress: () => onSelectStory(experience.storyId),
  }));
}
