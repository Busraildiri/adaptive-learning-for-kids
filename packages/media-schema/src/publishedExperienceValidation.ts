/**
 * Phase 7: defensive graph validation for a PublishedStoryExperience,
 * reusing graphValidation.ts's collectGraphIssues rather than re-implementing
 * dangling-reference/cycle detection. PublishedPlaybackClip's shape differs
 * from the production StoryPlaybackGraph clip shape (a decision clip's
 * options live at the top level, not nested under `choice`), so this module
 * is a structural adapter into GraphClipLike -- not a second validator.
 */
import { collectGraphIssues, type GraphIssue } from "./graphValidation";
import type { PublishedPlaybackClip, PublishedStoryExperience } from "./types";

function toGraphClipLike(clip: PublishedPlaybackClip) {
  if (clip.kind === "linear") {
    return { id: clip.id, kind: "linear" as const, nextClipId: clip.nextClipId };
  }
  if (clip.kind === "ending") {
    return { id: clip.id, kind: "ending" as const };
  }
  return {
    id: clip.id,
    kind: "decision" as const,
    choice: {
      options: clip.options.map((option) => ({ id: option.id, nextClipId: option.nextClipId })),
    },
  };
}

export function validatePublishedExperienceGraph(
  experience: PublishedStoryExperience,
): GraphIssue[] {
  return collectGraphIssues({
    startClipId: experience.startClipId,
    clips: experience.clips.map(toGraphClipLike),
  });
}
