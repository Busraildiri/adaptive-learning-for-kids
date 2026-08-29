import type { Asset, Story } from "@adaptive/content-schema";

/** Flattens every step's narration/prompt/feedback into an ordered, human-readable
 * list. Extracted from the review-queue preview so both the legacy review workspace
 * and the new Content Production Studio render a Story the same way. */
export function storyNarratives(story: Story): string[] {
  return story.steps.flatMap((step) => {
    if (step.type === "emotion_choice") {
      return [
        step.prompt,
        ...step.choices.map(
          (choice) => `${choice.accessibilityLabel}: ${choice.supportiveFeedback.narration}`,
        ),
        step.storyResolution.narration,
      ];
    }
    if (step.type === "choice") {
      return [step.prompt, ...step.choices.map((choice) => choice.accessibilityLabel)];
    }
    if (step.type === "tap") {
      return [step.prompt, step.completionNarration];
    }
    if (step.type === "help_choice") {
      return [step.prompt, ...step.choices.map((choice) => choice.resultNarration)];
    }
    return [step.narration];
  });
}

export function findAssetById(assets: Asset[], id: string | undefined): Asset | undefined {
  return assets.find((asset) => asset.id === id);
}
