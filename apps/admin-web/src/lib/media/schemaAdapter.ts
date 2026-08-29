import type { Story, StoryStep } from "@adaptive/content-schema";
import type { SceneEmotion, SceneGenerationSpec } from "./types";

export interface SceneAdapterOptions {
  characterId?: string;
  defaultDurationSeconds?: number;
}

const DEFAULT_DURATION_SECONDS = 5;

// Exported for reuse by scenePlanner.ts, which needs the same per-step
// headline-narration logic while walking a Story's steps into a branching
// StoryPlaybackGraph -- kept here rather than duplicated.
export function narrationOf(step: StoryStep): string | undefined {
  switch (step.type) {
    case "event":
    case "closing":
    case "breathing":
      return step.narration;
    case "tap":
    case "choice":
    case "help_choice":
    case "emotion_choice":
      return step.prompt;
    default:
      return undefined;
  }
}

function emotionOf(_step: StoryStep): SceneEmotion {
  return "neutral";
}

function visualPromptOf(story: Story, step: StoryStep, narration: string): string {
  return [story.title, step.type, narration].filter(Boolean).join(" — ");
}

export function buildSceneGenerationSpecs(
  story: Story,
  options: SceneAdapterOptions = {},
): SceneGenerationSpec[] {
  const duration = options.defaultDurationSeconds ?? DEFAULT_DURATION_SECONDS;
  const specs: SceneGenerationSpec[] = [];
  for (const step of story.steps) {
    const narration = narrationOf(step);
    if (!narration) continue;
    specs.push({
      sceneId: step.id,
      storyId: story.id,
      characterId: options.characterId,
      emotion: emotionOf(step),
      event: step.id,
      narration,
      visualPrompt: visualPromptOf(story, step, narration),
      duration,
    });
  }
  return specs;
}
