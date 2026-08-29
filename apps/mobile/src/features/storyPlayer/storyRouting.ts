/**
 * Decides whether a selected storyId opens the existing (bundled,
 * interactive_ui) MinoStory or the new (published, video_branching)
 * StoryPlayer. Deliberately explicit and unit-tested rather than left to
 * array lookup order: if a storyId somehow exists in both catalogs, the
 * bundled interactive_ui story wins and the published one is ignored
 * (logged), rather than silently replacing existing content.
 */

import type { Story } from "@adaptive/content-schema";
import type { PublishedStoryExperience } from "@adaptive/media-schema";

export type StoryRoute =
  | { kind: "bundled"; story: Story }
  | { kind: "published"; experience: PublishedStoryExperience }
  | { kind: "none" };

export function resolveStoryRoute(
  storyId: string | null,
  bundledStories: Story[],
  publishedExperiences: PublishedStoryExperience[],
): StoryRoute {
  if (!storyId) return { kind: "none" };

  const bundled = bundledStories.find((story) => story.id === storyId);
  const published = publishedExperiences.find((experience) => experience.storyId === storyId);

  if (bundled && published) {
    console.warn(
      `[storyRouting] storyId "${storyId}" exists both as a bundled interactive_ui story and a ` +
        "published video_branching experience -- keeping the bundled story, ignoring the published one.",
    );
    return { kind: "bundled", story: bundled };
  }
  if (bundled) return { kind: "bundled", story: bundled };
  if (published) return { kind: "published", experience: published };
  return { kind: "none" };
}
