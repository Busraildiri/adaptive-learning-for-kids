import type { PublishedStoryExperience } from "@adaptive/media-schema";

export interface PublishedStorySelectionCard {
  storyId: string;
  title: string;
  symbol: string;
  accessibilityLabel: string;
  onPress: () => void;
  recommended: boolean;
  coverMediaRef?: string;
}

const DEFAULT_SYMBOL = "🎬";

export function createPublishedStorySelectionCards(
  experiences: PublishedStoryExperience[],
  onSelectStory: (storyId: string) => void,
): PublishedStorySelectionCard[] {
  return experiences.map((experience) => {
    const startClip = experience.clips.find((clip) => clip.id === experience.startClipId);
    const automaticCoverMediaRef =
      startClip && startClip.kind !== "decision" ? startClip.video.mediaRef : undefined;
    return {
      storyId: experience.storyId,
      title: experience.title,
      symbol: DEFAULT_SYMBOL,
      accessibilityLabel: `${experience.title} hikâyesini seç`,
      onPress: () => onSelectStory(experience.storyId),
      recommended: false,
      coverMediaRef: experience.coverMediaRef ?? automaticCoverMediaRef,
    };
  });
}
