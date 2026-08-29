/**
 * Scene Planner -- turns an ALREADY APPROVED content-agent Story into a
 * branching StoryPlaybackGraph (packages/media-schema) plus the
 * SceneGenerationSpec render input for every clip.
 *
 * This module never invents narrative content. It only derives structure
 * (topology + continuity context) from what the Story already says. This
 * replaces the "invent a story from a free prompt" role that
 * services/media-worker/media_worker/story_planner.py's PromptStoryPlanner
 * used to play independently of content-agent -- the useful parts of that
 * planner (multi-scene breakdown, character/visual continuity threading,
 * previous/current/ending scene state) live here now, applied to real
 * approved content instead of a fresh OpenAI call.
 *
 * MVP constraint: at most one decision point per Story, with exactly two
 * options (matching the Phase 1 StoryPlaybackGraph Choice contract). A
 * Story with more than one decision-capable step, or a decision step with
 * an option count other than two, is rejected explicitly rather than
 * silently truncated or arbitrarily resolved -- see
 * UnsupportedMultipleDecisionPointsError / UnsupportedDecisionOptionCountError.
 */
import type { Asset, Story, StoryStep } from "@adaptive/content-schema";
import {
  type PlaybackClip,
  type StoryPlaybackGraph,
  storyPlaybackGraphSchema,
} from "@adaptive/media-schema";
import { narrationOf } from "./schemaAdapter";
import type { SceneEmotion, SceneGenerationSpec } from "./types";

export class UnsupportedMultipleDecisionPointsError extends Error {
  constructor(stepIds: string[]) {
    super(
      `Story has ${stepIds.length} decision-capable steps (${stepIds.join(", ")}); ` +
        "the MVP scene planner supports at most one decision point per story.",
    );
    this.name = "UnsupportedMultipleDecisionPointsError";
  }
}

export class UnsupportedDecisionOptionCountError extends Error {
  constructor(stepId: string, count: number) {
    super(
      `Decision step "${stepId}" has ${count} choices; the MVP scene planner ` +
        "requires exactly two (matching the StoryPlaybackGraph Choice contract).",
    );
    this.name = "UnsupportedDecisionOptionCountError";
  }
}

export interface ContinuityContext {
  characterDescription: string;
  // Actual visual/art identity (watercolor, flat vector, ...), derived from
  // Story/asset semantic metadata when such data exists. content-schema has
  // no field encoding this today, so it stays undefined -- never a made-up
  // art style -- distinct from the system-enforced safety constraints below.
  visualStyle?: string;
  // Always present: system-enforced preschool-safe render constraints, not
  // derived from (and not a substitute for) the story's own visual identity.
  safetyConstraints: string;
  environment: string;
  persistentProps: string;
  // content-schema has no per-story/step emotion field. Undefined is the
  // honest "no data" marker -- "neutral" would be a real semantic claim
  // (calm mood), not an absence marker, so it's not used as a fallback here.
  initialEmotionalState?: string;
}

export interface ScenePlanningMetadata {
  clipId: string;
  continuity: ContinuityContext;
  previousSceneState?: string;
  currentSceneGoal: string;
  endingState: string;
}

export interface StoryPlaybackPlan {
  graph: StoryPlaybackGraph;
  scenes: SceneGenerationSpec[];
  planningMetadata: Record<string, ScenePlanningMetadata>;
}

export interface PlanStoryPlaybackOptions {
  assetCatalog?: Asset[];
  sourceRequestId?: string;
  defaultDurationSeconds?: number;
  characterId?: string;
}

type DecisionStep = Extract<StoryStep, { type: "choice" | "help_choice" | "emotion_choice" }>;

function isDecisionCapableStep(step: StoryStep): step is DecisionStep {
  return step.type === "choice" || step.type === "help_choice" || step.type === "emotion_choice";
}

function decisionChoiceIds(step: DecisionStep): string[] {
  return step.choices.map((choice) => choice.id);
}

function decisionOptionNarration(step: DecisionStep, choiceId: string): string {
  // Narrow `step` on its own type FIRST, then read `.choices` -- a `choice`
  // value computed before narrowing keeps the pre-narrowing union type even
  // after `step.type` is checked, since TS doesn't retroactively narrow an
  // already-derived sibling value.
  if (step.type === "help_choice") {
    const choice = step.choices.find((candidate) => candidate.id === choiceId);
    if (!choice) throw new Error(`Choice "${choiceId}" not found on step "${step.id}".`);
    return choice.resultNarration;
  }
  if (step.type === "emotion_choice") {
    const choice = step.choices.find((candidate) => candidate.id === choiceId);
    if (!choice) throw new Error(`Choice "${choiceId}" not found on step "${step.id}".`);
    return choice.supportiveFeedback.narration;
  }
  const choice = step.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Choice "${choiceId}" not found on step "${step.id}".`);
  return choice.acknowledgement;
}

function decisionOptionEmotion(step: DecisionStep, choiceId: string): SceneEmotion {
  if (step.type !== "emotion_choice") return "neutral";
  const choice = step.choices.find((candidate) => candidate.id === choiceId);
  return choice?.emotion ?? "neutral";
}

function findAssetById(assets: Asset[] | undefined, id: string | undefined): Asset | undefined {
  if (!id || !assets) return undefined;
  return assets.find((asset) => asset.id === id);
}

function describeAsset(asset: Asset): string {
  return asset.semantic?.character ?? asset.semantic?.object ?? asset.accessibilityLabel ?? asset.id;
}

/**
 * Structured, deterministic derivation from the Story's own authored fields
 * (character asset ids, scene asset id, age bands, flow assets) plus
 * whatever semantic metadata the optional asset catalog provides -- never a
 * fresh model call, never invented character/style prose. When the Story
 * doesn't have enough structured information for a field, the fallback
 * names the actual asset id/field that was used instead of fabricating
 * descriptive content.
 */
export function deriveContinuityContext(story: Story, assetCatalog?: Asset[]): ContinuityContext {
  const characterAssetIds = [
    story.characterAssets.happyAssetId,
    story.characterAssets.sadAssetId,
    story.characterAssets.angryAssetId,
  ].filter((id): id is string => Boolean(id));
  const characterAssets = characterAssetIds
    .map((id) => findAssetById(assetCatalog, id))
    .filter((asset): asset is Asset => Boolean(asset));
  const characterDescription =
    characterAssets.length > 0
      ? `Main character consistent with: ${[...new Set(characterAssets.map(describeAsset))].join(", ")}.`
      : `Main character consistent across story asset ids: ${characterAssetIds.join(", ")}.`;

  // content-schema/Asset has no field describing actual art style (watercolor,
  // flat vector, etc.) today, so this is left undefined rather than inventing
  // one. If a future field ever encodes it (e.g. asset.presentation or a new
  // story-level field), derive it here instead of hard-coding a style.
  const visualStyle: string | undefined = undefined;

  const safetyConstraints =
    "Preschool-safe children's storybook illustration, warm and reassuring, one clear action, " +
    "soft natural light, clean composition, no written words, no letters, no logos, no watermark. " +
    `Appropriate for ages ${story.ageBands.join(", ")}.`;

  const sceneAsset = findAssetById(assetCatalog, story.sceneAssetId);
  const environment = sceneAsset
    ? describeAsset(sceneAsset)
    : story.sceneAssetId
      ? `Setting referenced by asset id "${story.sceneAssetId}".`
      : "Setting established by the story's opening scene.";

  const persistentProps =
    story.flowAssetIds && story.flowAssetIds.length > 0
      ? `Recurring visual elements: ${story.flowAssetIds.join(", ")}.`
      : "No recurring props beyond the main character.";

  return {
    characterDescription,
    visualStyle,
    safetyConstraints,
    environment,
    persistentProps,
    // content-schema carries no per-step/story-level emotion field to derive
    // an opening emotional state from. Undefined is the honest "no data"
    // marker; "neutral" would be a real (invented) semantic claim instead.
    initialEmotionalState: undefined,
  };
}

function composeVisualPrompt(
  continuity: ContinuityContext,
  previousSceneState: string | undefined,
  currentSceneGoal: string,
  endingState: string,
): string {
  // Undefined fields are omitted rather than interpolated -- an omitted
  // section is the honest "no data" representation; stringifying `undefined`
  // into the prompt would silently leak the literal text "undefined".
  const globalContinuity = [
    continuity.characterDescription,
    continuity.visualStyle ? `Visual style: ${continuity.visualStyle}.` : undefined,
    continuity.safetyConstraints,
    `Environment: ${continuity.environment}`,
    continuity.persistentProps,
    continuity.initialEmotionalState
      ? `Initial emotional state: ${continuity.initialEmotionalState}.`
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  return [
    `GLOBAL CONTINUITY: ${globalContinuity}`,
    `PREVIOUS SCENE STATE: ${previousSceneState ?? "Story opening; no prior scene."}`,
    `CURRENT SCENE GOAL: ${currentSceneGoal}`,
    `ENDING STATE: ${endingState}`,
  ].join("\n");
}

interface PlanBuilder {
  clips: StoryPlaybackGraph["clips"];
  scenes: SceneGenerationSpec[];
  planningMetadata: Record<string, ScenePlanningMetadata>;
}

function addScene(
  builder: PlanBuilder,
  story: Story,
  clipId: string,
  narration: string,
  emotion: SceneEmotion,
  duration: number,
  characterId: string | undefined,
  continuity: ContinuityContext,
  previousSceneState: string | undefined,
): void {
  const visualPrompt = composeVisualPrompt(continuity, previousSceneState, narration, narration);
  builder.scenes.push({
    sceneId: clipId,
    storyId: story.id,
    characterId,
    emotion,
    event: clipId,
    narration,
    visualPrompt,
    duration,
  });
  builder.planningMetadata[clipId] = {
    clipId,
    continuity,
    previousSceneState,
    currentSceneGoal: narration,
    endingState: narration,
  };
}

export function planStoryPlayback(
  story: Story,
  options: PlanStoryPlaybackOptions = {},
): StoryPlaybackPlan {
  const duration = options.defaultDurationSeconds ?? 5;
  const continuity = deriveContinuityContext(story, options.assetCatalog);

  const decisionSteps = story.steps.filter(isDecisionCapableStep);
  if (decisionSteps.length > 1) {
    throw new UnsupportedMultipleDecisionPointsError(decisionSteps.map((step) => step.id));
  }
  const decisionStep = decisionSteps[0];
  if (decisionStep) {
    const choiceIds = decisionChoiceIds(decisionStep);
    if (choiceIds.length !== 2) {
      throw new UnsupportedDecisionOptionCountError(decisionStep.id, choiceIds.length);
    }
  }

  // The narratable "spine": every step that carries headline narration, in
  // story order, regardless of type -- including the decision step itself
  // (its `prompt` is what plays while the choice is being made).
  const spine = story.steps
    .map((step) => ({ step, narration: narrationOf(step) }))
    .filter((entry): entry is { step: StoryStep; narration: string } => Boolean(entry.narration));

  const decisionIndex = decisionStep ? spine.findIndex((entry) => entry.step.id === decisionStep.id) : -1;

  const builder: PlanBuilder = { clips: [], scenes: [], planningMetadata: {} };
  let previousState: string | undefined;
  const linearRunEnd = decisionIndex === -1 ? spine.length : decisionIndex;

  for (let index = 0; index < linearRunEnd; index += 1) {
    const { step, narration } = spine[index];
    addScene(builder, story, step.id, narration, "neutral", duration, options.characterId, continuity, previousState);
    previousState = narration;
    const isLast = index === spine.length - 1;
    builder.clips.push(
      isLast
        ? { kind: "ending", id: step.id, sourceSceneId: step.id }
        : { kind: "linear", id: step.id, sourceSceneId: step.id, nextClipId: spine[index + 1].step.id },
    );
  }

  if (decisionStep) {
    const decisionNarration = spine[decisionIndex].narration;
    addScene(
      builder,
      story,
      decisionStep.id,
      decisionNarration,
      "neutral",
      duration,
      options.characterId,
      continuity,
      previousState,
    );
    const decisionEndingState = decisionNarration;

    // Where both branches rejoin: the next spine entry after the decision
    // step, if any. Multiple clips are allowed to point their nextClipId at
    // the same downstream id (a DAG merge) -- the Phase 1 validator treats a
    // revisited already-processed node as a legitimate convergence, not a
    // cycle, so this doesn't need special-casing there.
    const tailStart = decisionIndex + 1;
    const rejoinId = tailStart < spine.length ? spine[tailStart].step.id : undefined;

    // emotion_choice carries a shared post-choice resolution that isn't a
    // separate story step -- synthesize it as its own clip so it isn't
    // silently dropped, matching "approved narration must not be lost."
    const resolutionClipId =
      decisionStep.type === "emotion_choice" ? `${decisionStep.id}-resolution` : undefined;
    const branchTargetId = resolutionClipId ?? rejoinId;

    const buildOption = (choice: { id: string; accessibilityLabel: string }) => {
      const optionClipId = `${decisionStep.id}-${choice.id}`;
      const optionNarration = decisionOptionNarration(decisionStep, choice.id);
      addScene(
        builder,
        story,
        optionClipId,
        optionNarration,
        decisionOptionEmotion(decisionStep, choice.id),
        duration,
        options.characterId,
        continuity,
        decisionEndingState,
      );
      builder.clips.push(
        branchTargetId
          ? { kind: "linear", id: optionClipId, sourceSceneId: decisionStep.id, nextClipId: branchTargetId }
          : { kind: "ending", id: optionClipId, sourceSceneId: decisionStep.id },
      );
      return { id: choice.id, label: choice.accessibilityLabel, nextClipId: optionClipId };
    };
    // Already validated to be exactly two above (UnsupportedDecisionOptionCountError
    // otherwise) -- destructuring into a literal 2-element array gives Zod's
    // exact [ChoiceOption, ChoiceOption] tuple shape without an `as` cast.
    const [firstChoice, secondChoice] = decisionStep.choices;
    // Explicit tuple annotation: a bare `[a, b]` array literal infers as
    // T[], not the fixed 2-tuple the Choice.options contract requires.
    const choiceOptions: [ReturnType<typeof buildOption>, ReturnType<typeof buildOption>] = [
      buildOption(firstChoice),
      buildOption(secondChoice),
    ];

    builder.clips.push({
      kind: "decision",
      id: decisionStep.id,
      sourceSceneId: decisionStep.id,
      choice: { question: decisionNarration, options: choiceOptions },
    });

    if (resolutionClipId && decisionStep.type === "emotion_choice") {
      const resolutionNarration = decisionStep.storyResolution.narration;
      addScene(
        builder,
        story,
        resolutionClipId,
        resolutionNarration,
        "neutral",
        duration,
        options.characterId,
        continuity,
        decisionEndingState,
      );
      builder.clips.push(
        rejoinId
          ? { kind: "linear", id: resolutionClipId, sourceSceneId: decisionStep.id, nextClipId: rejoinId }
          : { kind: "ending", id: resolutionClipId, sourceSceneId: decisionStep.id },
      );
    }

    for (let index = tailStart; index < spine.length; index += 1) {
      const { step, narration } = spine[index];
      const isLast = index === spine.length - 1;
      addScene(
        builder,
        story,
        step.id,
        narration,
        "neutral",
        duration,
        options.characterId,
        continuity,
        index === tailStart ? decisionEndingState : spine[index - 1].narration,
      );
      builder.clips.push(
        isLast
          ? { kind: "ending", id: step.id, sourceSceneId: step.id }
          : { kind: "linear", id: step.id, sourceSceneId: step.id, nextClipId: spine[index + 1].step.id },
      );
    }
  }

  const graph = storyPlaybackGraphSchema.parse({
    id: crypto.randomUUID(), // provisional -- the persistence RPC assigns the real id (Phase 4)
    storyId: story.id,
    storyVersion: story.version,
    sourceRequestId: options.sourceRequestId,
    startClipId: spine[0]?.step.id ?? decisionStep?.id,
    clips: builder.clips,
  });

  return { graph, scenes: builder.scenes, planningMetadata: builder.planningMetadata };
}

export type VideoBranchingCompatibilityResult =
  | { compatible: true; graph: StoryPlaybackGraph }
  | { compatible: false; reason: string };

/**
 * Phase 5.5 pre-review gate: deterministic, reused (not duplicated) Scene
 * Planner semantics. planStoryPlayback() is the single source of truth for
 * "does this Story's topology fit the MVP contract" -- this function does
 * NOT re-implement decision-counting; it calls the real planner and then
 * explicitly asserts every clause of the contract on the result, rather
 * than reporting "compatible" merely because the planner didn't throw:
 *   - experienceType is actually "video_branching"
 *   - the produced graph re-validates against storyPlaybackGraphSchema
 *   - the graph has exactly one decision clip
 *   - that decision clip has exactly two options
 *   - both options' nextClipId resolve to a real clip in the same graph
 */
export function validateVideoBranchingCompatibility(
  story: Story,
  options: PlanStoryPlaybackOptions = {},
): VideoBranchingCompatibilityResult {
  if (story.experienceType !== "video_branching") {
    return {
      compatible: false,
      reason: `Story experienceType is "${story.experienceType}", not "video_branching".`,
    };
  }

  let plan: StoryPlaybackPlan;
  try {
    plan = planStoryPlayback(story, options);
  } catch (error) {
    return {
      compatible: false,
      reason: error instanceof Error ? error.message : "Sahne planı oluşturulamadı.",
    };
  }

  // Independent re-validation of the planner's own output, rather than
  // trusting the internal storyPlaybackGraphSchema.parse() call inside
  // planStoryPlayback() without confirmation.
  const parsedGraph = storyPlaybackGraphSchema.safeParse(plan.graph);
  if (!parsedGraph.success) {
    return {
      compatible: false,
      reason: `Graph failed storyPlaybackGraphSchema: ${parsedGraph.error.issues[0]?.message ?? "unknown issue"}`,
    };
  }
  const graph = parsedGraph.data;

  const decisionClips = graph.clips.filter(
    (clip): clip is Extract<PlaybackClip, { kind: "decision" }> => clip.kind === "decision",
  );
  if (decisionClips.length !== 1) {
    return {
      compatible: false,
      reason: `Graph has ${decisionClips.length} decision clip(s); exactly 1 is required.`,
    };
  }
  const [decisionClip] = decisionClips;
  if (decisionClip.choice.options.length !== 2) {
    return {
      compatible: false,
      reason: `Decision clip has ${decisionClip.choice.options.length} option(s); exactly 2 are required.`,
    };
  }

  const clipIds = new Set(graph.clips.map((clip) => clip.id));
  const missingTargets = decisionClip.choice.options.filter(
    (option) => !clipIds.has(option.nextClipId),
  );
  if (missingTargets.length > 0) {
    return {
      compatible: false,
      reason: `Choice option(s) point to missing clip id(s): ${missingTargets
        .map((option) => option.nextClipId)
        .join(", ")}.`,
    };
  }

  return { compatible: true, graph };
}
