import { type Asset, contentVersionSchema, type Story } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { storyPlaybackGraphSchema } from "@adaptive/media-schema";
import { describe, expect, it } from "vitest";
import {
  deriveContinuityContext,
  planStoryPlayback,
  UnsupportedDecisionOptionCountError,
  UnsupportedMultipleDecisionPointsError,
  validateVideoBranchingCompatibility,
} from "./scenePlanner";

function baseStory(steps: Story["steps"]): Story {
  return {
    id: "story-1",
    version: 1,
    title: "Mırmır'ın Balonu",
    ageBands: ["2-4"],
    targetSkills: ["self_advocacy"],
    greetingTemplate: "Merhaba!",
    experienceType: "video_branching",
    characterAssets: { happyAssetId: "mirmir-happy", sadAssetId: "mirmir-sad" },
    steps,
  };
}

function findClip(plan: ReturnType<typeof planStoryPlayback>, id: string) {
  const clip = plan.graph.clips.find((candidate) => candidate.id === id);
  if (!clip) throw new Error(`clip "${id}" not found`);
  return clip;
}

describe("planStoryPlayback: purely linear story (no decision-capable step)", () => {
  const story = baseStory([
    { id: "intro", type: "event", narration: "Mırmır parkta oynuyordu." },
    { id: "closing", type: "closing", narration: "Ve hep birlikte eve döndüler." },
  ]);
  const plan = planStoryPlayback(story);

  it("produces one linear clip followed by one ending clip", () => {
    expect(plan.graph.clips).toHaveLength(2);
    expect(findClip(plan, "intro")).toMatchObject({ kind: "linear", nextClipId: "closing" });
    expect(findClip(plan, "closing")).toMatchObject({ kind: "ending" });
  });

  it("starts at the first narratable step", () => {
    expect(plan.graph.startClipId).toBe("intro");
  });

  it("threads previousSceneState across the linear chain", () => {
    expect(plan.planningMetadata.intro.previousSceneState).toBeUndefined();
    expect(plan.planningMetadata.closing.previousSceneState).toBe("Mırmır parkta oynuyordu.");
  });

  it("passes the Phase 1 graph validator", () => {
    expect(storyPlaybackGraphSchema.safeParse(plan.graph).success).toBe(true);
  });

  it('never leaks the literal string "undefined" into a composed visualPrompt', () => {
    // Regression guard: visualStyle/initialEmotionalState are undefined by
    // default (no asset catalog supplied), so a naive template-literal
    // interpolation would stringify them as the text "undefined".
    for (const scene of plan.scenes) {
      expect(scene.visualPrompt).not.toContain("undefined");
    }
  });
});

describe("planStoryPlayback: single help_choice decision, no trailing steps", () => {
  const story = baseStory([
    { id: "intro", type: "event", narration: "Mırmır balonu düşürdü." },
    {
      id: "help_01",
      type: "help_choice",
      prompt: "Mırmır'a nasıl yardım etmek istersin?",
      choices: [
        {
          id: "hug",
          action: "hug",
          accessibilityLabel: "Sarıl",
          resultNarration: "Mırmır sarılınca rahatladı.",
        },
        {
          id: "balloon",
          action: "new_balloon",
          accessibilityLabel: "Yeni balon bul",
          resultNarration: "Yeni balon Mırmır'ı çok mutlu etti.",
        },
      ],
    },
  ]);
  const plan = planStoryPlayback(story);

  it("builds a decision clip with exactly two options pointing at distinct clips", () => {
    const decision = findClip(plan, "help_01");
    expect(decision.kind).toBe("decision");
    if (decision.kind !== "decision") throw new Error("expected decision clip");
    expect(decision.choice.options.map((option) => option.nextClipId)).toEqual([
      "help_01-hug",
      "help_01-balloon",
    ]);
  });

  it("each option becomes its own ending clip carrying that choice's approved resultNarration", () => {
    expect(findClip(plan, "help_01-hug").kind).toBe("ending");
    expect(findClip(plan, "help_01-balloon").kind).toBe("ending");
    expect(plan.scenes.find((s) => s.sceneId === "help_01-hug")?.narration).toBe(
      "Mırmır sarılınca rahatladı.",
    );
    expect(plan.scenes.find((s) => s.sceneId === "help_01-balloon")?.narration).toBe(
      "Yeni balon Mırmır'ı çok mutlu etti.",
    );
  });

  it("both branch endings start from the same decision-scene ending state", () => {
    expect(plan.planningMetadata["help_01-hug"].previousSceneState).toBe(
      plan.planningMetadata["help_01-balloon"].previousSceneState,
    );
    expect(plan.planningMetadata["help_01-hug"].previousSceneState).toBe(
      "Mırmır'a nasıl yardım etmek istersin?",
    );
  });
});

describe("planStoryPlayback: decision with a shared trailing step", () => {
  const story = baseStory([
    {
      id: "help_01",
      type: "help_choice",
      prompt: "Ne yapmak istersin?",
      choices: [
        { id: "a", action: "hug", accessibilityLabel: "A", resultNarration: "Sonuç A." },
        { id: "b", action: "new_balloon", accessibilityLabel: "B", resultNarration: "Sonuç B." },
      ],
    },
    { id: "closing", type: "closing", narration: "Hep birlikte gülümsediler." },
  ]);
  const plan = planStoryPlayback(story);

  it("both branch clips converge into the shared trailing clip instead of ending directly", () => {
    expect(findClip(plan, "help_01-a")).toMatchObject({ kind: "linear", nextClipId: "closing" });
    expect(findClip(plan, "help_01-b")).toMatchObject({ kind: "linear", nextClipId: "closing" });
    expect(findClip(plan, "closing").kind).toBe("ending");
  });

  it("passes the Phase 1 graph validator (DAG merge is not a cycle)", () => {
    expect(storyPlaybackGraphSchema.safeParse(plan.graph).success).toBe(true);
  });
});

describe("planStoryPlayback: emotion_choice decision preserves the shared storyResolution", () => {
  const story = baseStory([
    {
      id: "feel_01",
      type: "emotion_choice",
      prompt: "Nasıl hissediyorsun?",
      choices: [
        {
          id: "happy",
          emotion: "happy",
          accessibilityLabel: "Mutlu",
          supportiveFeedback: { narration: "Mutlu olmak güzel." },
        },
        {
          id: "sad",
          emotion: "sad",
          accessibilityLabel: "Üzgün",
          supportiveFeedback: { narration: "Üzgün olmak da normal." },
        },
      ],
      storyResolution: { narration: "Her duygu kabul edilir." },
    },
  ]);
  const plan = planStoryPlayback(story);

  it("synthesizes a resolution clip carrying storyResolution.narration rather than dropping it", () => {
    const resolution = findClip(plan, "feel_01-resolution");
    expect(resolution.kind).toBe("ending");
    expect(plan.scenes.find((s) => s.sceneId === "feel_01-resolution")?.narration).toBe(
      "Her duygu kabul edilir.",
    );
  });

  it("both emotion options route into the resolution clip, carrying the choice's own emotion", () => {
    expect(findClip(plan, "feel_01-happy")).toMatchObject({
      kind: "linear",
      nextClipId: "feel_01-resolution",
    });
    expect(findClip(plan, "feel_01-sad")).toMatchObject({
      kind: "linear",
      nextClipId: "feel_01-resolution",
    });
    expect(plan.scenes.find((s) => s.sceneId === "feel_01-happy")?.emotion).toBe("happy");
    expect(plan.scenes.find((s) => s.sceneId === "feel_01-sad")?.emotion).toBe("sad");
  });
});

describe("planStoryPlayback: unsupported edge cases are rejected explicitly", () => {
  it("rejects a story with more than one decision-capable step", () => {
    const story = baseStory([
      {
        id: "help_01",
        type: "help_choice",
        prompt: "?",
        choices: [
          { id: "a", action: "hug", accessibilityLabel: "A", resultNarration: "A." },
          { id: "b", action: "breathe", accessibilityLabel: "B", resultNarration: "B." },
        ],
      },
      {
        id: "help_02",
        type: "help_choice",
        prompt: "?",
        choices: [
          { id: "c", action: "hug", accessibilityLabel: "C", resultNarration: "C." },
          { id: "d", action: "breathe", accessibilityLabel: "D", resultNarration: "D." },
        ],
      },
    ]);
    expect(() => planStoryPlayback(story)).toThrow(UnsupportedMultipleDecisionPointsError);
  });

  it("rejects a decision step with three choices instead of exactly two", () => {
    const story = baseStory([
      {
        id: "help_01",
        type: "help_choice",
        prompt: "?",
        choices: [
          { id: "a", action: "hug", accessibilityLabel: "A", resultNarration: "A." },
          { id: "b", action: "breathe", accessibilityLabel: "B", resultNarration: "B." },
          { id: "c", action: "new_balloon", accessibilityLabel: "C", resultNarration: "C." },
        ],
      },
    ]);
    expect(() => planStoryPlayback(story)).toThrow(UnsupportedDecisionOptionCountError);
  });
});

describe("deriveContinuityContext", () => {
  const story = baseStory([{ id: "intro", type: "event", narration: "..." }]);

  it("falls back to referencing real asset ids, never inventing character prose", () => {
    const context = deriveContinuityContext(story);
    expect(context.characterDescription).toContain("mirmir-happy");
    expect(context.characterDescription).toContain("mirmir-sad");
  });

  it("leaves visualStyle and initialEmotionalState undefined rather than inventing values", () => {
    const context = deriveContinuityContext(story);
    // content-schema has no field encoding actual art style or a
    // story/step-level emotion -- both must stay absent, not defaulted to
    // some invented style or to "neutral" (a real semantic claim).
    expect(context.visualStyle).toBeUndefined();
    expect(context.initialEmotionalState).toBeUndefined();
  });

  it("still applies system-enforced safety constraints regardless of missing style data", () => {
    const context = deriveContinuityContext(story);
    expect(context.safetyConstraints.length).toBeGreaterThan(0);
    expect(context.safetyConstraints).toContain("Preschool-safe");
  });

  it("uses semantic asset metadata when an asset catalog is supplied", () => {
    const assets: Asset[] = [
      {
        id: "mirmir-happy",
        type: "image",
        uri: "app-assets://mirmir-happy.png",
        mimeType: "image/png",
        semantic: {
          character: "Mırmır (turuncu kedi)",
          object: "kedi",
          eventState: "mutlu",
          emotion: "happy",
          allowedNarrativeTerms: ["kedi"],
          prohibitedNarrativeTerms: [],
          reviewStatus: "approved",
          rightsStatus: "cleared",
          provenance: {
            source: "owned",
            aiGenerated: false,
            generatedByUser: false,
            thirdPartyReferencesDeclared: false,
            disclosure: "n/a",
          },
        },
      },
    ];
    const context = deriveContinuityContext(story, assets);
    expect(context.characterDescription).toContain("Mırmır (turuncu kedi)");
  });
});

const twoHelpChoices: Story["steps"][number] = {
  id: "help_01",
  type: "help_choice",
  prompt: "Nasıl yardım edelim?",
  choices: [
    { id: "a", action: "hug", accessibilityLabel: "Sarıl", resultNarration: "Sarıldı." },
    { id: "b", action: "breathe", accessibilityLabel: "Nefes al", resultNarration: "Nefes aldı." },
  ],
};

describe("validateVideoBranchingCompatibility", () => {
  it("is incompatible when experienceType is not video_branching", () => {
    const story = {
      ...baseStory([{ id: "intro", type: "event", narration: "..." }, twoHelpChoices]),
      experienceType: "interactive_ui" as const,
    };
    const result = validateVideoBranchingCompatibility(story);
    expect(result.compatible).toBe(false);
    if (result.compatible) throw new Error("expected incompatible");
    expect(result.reason).toContain("video_branching");
  });

  it("is compatible for a single decision point with exactly two choices", () => {
    const story = baseStory([
      { id: "intro", type: "event", narration: "Bir olay oldu." },
      twoHelpChoices,
    ]);
    const result = validateVideoBranchingCompatibility(story);
    expect(result.compatible).toBe(true);
    if (!result.compatible) throw new Error("expected compatible");
    expect(result.graph.clips.filter((clip) => clip.kind === "decision")).toHaveLength(1);
  });

  it("is incompatible for a story with two decision-capable steps -- the exact Phase 5 mismatch", () => {
    const story = baseStory([
      { id: "intro", type: "event", narration: "Bir olay oldu." },
      twoHelpChoices,
      { ...twoHelpChoices, id: "help_02", prompt: "Bir daha nasıl yardım edelim?" },
    ]);
    const result = validateVideoBranchingCompatibility(story);
    expect(result.compatible).toBe(false);
    if (result.compatible) throw new Error("expected incompatible");
    expect(result.reason).toMatch(/decision/i);
  });

  it("does not weaken the underlying constraint -- still exactly one decision, exactly two options", () => {
    const anotherChoiceStep: Story["steps"][number] = {
      id: "choose",
      type: "choice",
      prompt: "Bir tane seç.",
      choices: [
        {
          id: "a",
          accessibilityLabel: "A",
          visual: { kind: "balloon", color: "#F46F5E" },
          acknowledgement: "A.",
        },
        {
          id: "b",
          accessibilityLabel: "B",
          visual: { kind: "balloon", color: "#55A9D6" },
          acknowledgement: "B.",
        },
      ],
    };
    const story = baseStory([anotherChoiceStep, twoHelpChoices]);
    const result = validateVideoBranchingCompatibility(story);
    expect(result.compatible).toBe(false);
  });
});

// This is the regression guard against the exact Phase 5 integration
// mismatch: a canonical, bundled video_branching template must survive
// experienceType check -> validateVideoBranchingCompatibility ->
// planStoryPlayback -> a StoryPlaybackGraph that validates and has the
// precise single-decision/two-option/independent-endings shape. If this
// test ever fails, either the bundled template's topology drifted, or
// Scene Planner's contract changed underneath it -- both worth catching
// immediately rather than discovering at Studio runtime again.
describe("Phase 5.5 contract test: canonical video_branching template", () => {
  function loadCanonicalTemplate() {
    const content = contentVersionSchema.parse(contentJson);
    const story = content.stories.find(
      (candidate) => candidate.id === "video-branching-crayons-story",
    );
    if (!story) throw new Error("canonical video_branching template missing from bundled content");
    return { story, assets: content.assets };
  }

  it("has exactly one decision-capable step with exactly two choices", () => {
    const { story } = loadCanonicalTemplate();
    const decisionSteps = story.steps.filter(
      (step) =>
        step.type === "choice" || step.type === "help_choice" || step.type === "emotion_choice",
    );
    expect(decisionSteps).toHaveLength(1);
    const [decisionStep] = decisionSteps;
    if (!("choices" in decisionStep)) throw new Error("unreachable");
    expect(decisionStep.choices).toHaveLength(2);
  });

  it("declares experienceType video_branching and passes compatibility validation end to end", () => {
    const { story, assets } = loadCanonicalTemplate();
    expect(story.experienceType).toBe("video_branching");

    const compatibility = validateVideoBranchingCompatibility(story, { assetCatalog: assets });
    expect(compatibility.compatible).toBe(true);
    if (!compatibility.compatible) return;

    const graph = compatibility.graph;
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(true);

    const decisionClips = graph.clips.filter((clip) => clip.kind === "decision");
    expect(decisionClips).toHaveLength(1);
    const [decisionClip] = decisionClips;
    if (decisionClip.kind !== "decision") throw new Error("unreachable");
    expect(decisionClip.choice.options).toHaveLength(2);

    const clipIds = new Set(graph.clips.map((clip) => clip.id));
    for (const option of decisionClip.choice.options) {
      expect(clipIds.has(option.nextClipId)).toBe(true);
    }

    // No shared closing for v1 (Decision 3): each option must lead to its
    // own independent terminal ending, not a converging shared node.
    const [optionA, optionB] = decisionClip.choice.options;
    expect(optionA.nextClipId).not.toBe(optionB.nextClipId);
    expect(graph.clips.find((clip) => clip.id === optionA.nextClipId)?.kind).toBe("ending");
    expect(graph.clips.find((clip) => clip.id === optionB.nextClipId)?.kind).toBe("ending");
  });

  it("reaches planStoryPlayback directly with the same shape -- no second planner exists", () => {
    const { story, assets } = loadCanonicalTemplate();
    const plan = planStoryPlayback(story, { assetCatalog: assets });
    expect(plan.graph.clips.filter((clip) => clip.kind === "decision")).toHaveLength(1);
  });
});
