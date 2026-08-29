import type { PlaybackClip, StoryPlaybackGraph } from "@adaptive/media-schema";
import { describe, expect, it } from "vitest";
import type { MediaJob, StoryMediaReadiness } from "../../lib/media/types";
import {
  buildScenePlanCards,
  deriveClipRole,
  deriveReadinessBanner,
  deriveStudioStage,
  groupJobsByRole,
  isJobTerminal,
  isReadinessComplete,
  mapJobStatusLabel,
} from "./pipeline";

function job(overrides: Partial<MediaJob>): MediaJob {
  return {
    id: overrides.id ?? "job-1",
    storyId: "story-1",
    graphId: "graph-1",
    provider: "openmontage",
    mode: "local_animation",
    renderManifest: { scene: {}, mode: "local_animation", aspectRatio: "4:5" } as unknown as MediaJob["renderManifest"],
    mediaKind: "video",
    status: "queued",
    progress: 0,
    requestedBy: "admin-1",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

function readiness(overrides: Partial<StoryMediaReadiness> = {}): StoryMediaReadiness {
  return {
    totalClips: 3,
    readyClips: 3,
    failedClips: 0,
    pendingClips: 0,
    totalChoiceAudio: 3,
    readyChoiceAudio: 3,
    failedChoiceAudio: 0,
    pendingChoiceAudio: 0,
    ...overrides,
  };
}

const graph: Pick<StoryPlaybackGraph, "clips"> = {
  clips: [
    { kind: "linear", id: "scene-01", sourceSceneId: "scene-01", nextClipId: "help_01" },
    {
      kind: "decision",
      id: "help_01",
      sourceSceneId: "help_01",
      choice: {
        question: "Nasıl yardım edelim?",
        options: [
          { id: "hug", label: "Sarıl", nextClipId: "help_01-hug" },
          { id: "balloon", label: "Balon bul", nextClipId: "help_01-balloon" },
        ],
      },
    },
    { kind: "ending", id: "help_01-hug", sourceSceneId: "help_01" },
    { kind: "ending", id: "help_01-balloon", sourceSceneId: "help_01" },
  ],
};

describe("mapJobStatusLabel / isJobTerminal", () => {
  it("maps every backend status to an honest Turkish label", () => {
    expect(mapJobStatusLabel("queued")).toBe("Bekliyor");
    expect(mapJobStatusLabel("rendering")).toBe("Üretiliyor");
    expect(mapJobStatusLabel("uploading")).toBe("Yükleniyor");
    expect(mapJobStatusLabel("ready")).toBe("Hazır");
    expect(mapJobStatusLabel("failed")).toBe("Hata");
  });

  it("treats only ready/failed as terminal", () => {
    expect(isJobTerminal("ready")).toBe(true);
    expect(isJobTerminal("failed")).toBe(true);
    expect(isJobTerminal("queued")).toBe(false);
    expect(isJobTerminal("rendering")).toBe(false);
    expect(isJobTerminal("uploading")).toBe(false);
  });
});

describe("deriveClipRole", () => {
  it("labels the first clip as Giriş, decision as Karar, endings as Son", () => {
    expect(deriveClipRole(graph.clips[0] as PlaybackClip, 0)).toBe("Giriş");
    expect(deriveClipRole(graph.clips[1] as PlaybackClip, 1)).toBe("Karar");
    expect(deriveClipRole(graph.clips[2] as PlaybackClip, 2)).toBe("Son");
  });
});

describe("buildScenePlanCards", () => {
  it("renders the decision card's question and both options from the real graph, inventing no new topology", () => {
    const cards = buildScenePlanCards(graph);
    const decisionCard = cards.find((card) => card.clipId === "help_01");
    expect(decisionCard?.question).toBe("Nasıl yardım edelim?");
    expect(decisionCard?.options).toEqual([
      { id: "hug", label: "Sarıl", nextClipId: "help_01-hug" },
      { id: "balloon", label: "Balon bul", nextClipId: "help_01-balloon" },
    ]);
  });

  it("carries narration through when provided, and omits it when not", () => {
    const cards = buildScenePlanCards(graph, { "scene-01": "Bir kere olay oldu." });
    expect(cards.find((card) => card.clipId === "scene-01")?.narration).toBe("Bir kere olay oldu.");
    expect(cards.find((card) => card.clipId === "help_01-hug")?.narration).toBeUndefined();
  });
});

describe("groupJobsByRole", () => {
  const jobs: MediaJob[] = [
    job({ id: "v1", mediaKind: "video", sceneId: "scene-01", status: "ready" }),
    job({ id: "v2", mediaKind: "video", sceneId: "help_01-hug", status: "rendering" }),
    job({ id: "v3", mediaKind: "video", sceneId: "help_01-balloon", status: "failed", error: "boom" }),
    job({ id: "a1", mediaKind: "audio", audioRole: "question", sceneId: "help_01", status: "ready" }),
    job({
      id: "a2",
      mediaKind: "audio",
      audioRole: "choice",
      sceneId: "help_01",
      choiceId: "hug",
      status: "ready",
    }),
    job({
      id: "a3",
      mediaKind: "audio",
      audioRole: "choice",
      sceneId: "help_01",
      choiceId: "balloon",
      status: "queued",
    }),
  ];

  it("produces one video card per non-decision clip", () => {
    const { videoCards } = groupJobsByRole(graph.clips as PlaybackClip[], jobs);
    expect(videoCards.map((card) => card.key)).toEqual(["scene-01", "help_01-hug", "help_01-balloon"]);
    expect(videoCards.find((card) => card.key === "help_01-balloon")?.job?.status).toBe("failed");
  });

  it("a failed sibling card does not change another card's status", () => {
    const { videoCards } = groupJobsByRole(graph.clips as PlaybackClip[], jobs);
    expect(videoCards.find((card) => card.key === "scene-01")?.job?.status).toBe("ready");
    expect(videoCards.find((card) => card.key === "help_01-hug")?.job?.status).toBe("rendering");
  });

  it("produces one question card and one card per choice option, matched by choiceId", () => {
    const { audioCards } = groupJobsByRole(graph.clips as PlaybackClip[], jobs);
    expect(audioCards.map((card) => card.key)).toEqual([
      "help_01-question",
      "help_01-hug",
      "help_01-balloon",
    ]);
    expect(audioCards.find((card) => card.key === "help_01-hug")?.job?.id).toBe("a2");
    expect(audioCards.find((card) => card.key === "help_01-balloon")?.job?.id).toBe("a3");
  });

  it("leaves a card's job undefined when no matching job exists yet", () => {
    const { videoCards } = groupJobsByRole(graph.clips as PlaybackClip[], []);
    expect(videoCards.every((card) => card.job === undefined)).toBe(true);
  });
});

describe("isReadinessComplete / deriveReadinessBanner", () => {
  it("is complete only when every count is fully ready and nothing failed or is pending", () => {
    expect(isReadinessComplete(readiness())).toBe(true);
    expect(isReadinessComplete(readiness({ pendingClips: 1, readyClips: 2 }))).toBe(false);
    expect(isReadinessComplete(readiness({ failedChoiceAudio: 1 }))).toBe(false);
    expect(isReadinessComplete(undefined)).toBe(false);
  });

  it("reports partial_failure whenever anything failed, regardless of story approval", () => {
    const banner = deriveReadinessBanner(readiness({ failedClips: 1 }), true);
    expect(banner.kind).toBe("partial_failure");
  });

  it("only reports ready_for_publish when the story is approved AND readiness is complete", () => {
    expect(deriveReadinessBanner(readiness(), true).kind).toBe("ready_for_publish");
    expect(deriveReadinessBanner(readiness(), false).kind).toBe("in_progress");
  });

  it("reports in_progress with an honest ready/total count while still rendering", () => {
    const banner = deriveReadinessBanner(readiness({ readyClips: 1, pendingClips: 2 }), true);
    expect(banner.kind).toBe("in_progress");
    expect(banner.label).toContain("4/6");
  });
});

describe("deriveStudioStage", () => {
  it("starts idle with nothing generated yet", () => {
    expect(
      deriveStudioStage({ isGeneratingStory: false, isLoadingPlan: false, hasScenePlan: false }),
    ).toBe("idle");
  });

  it("is generating_story while the request is in flight, regardless of other state", () => {
    expect(
      deriveStudioStage({ isGeneratingStory: true, isLoadingPlan: false, hasScenePlan: false }),
    ).toBe("generating_story");
  });

  it("requires explicit approval before any media step -- pending never advances", () => {
    expect(
      deriveStudioStage({
        isGeneratingStory: false,
        reviewStatus: "pending",
        isLoadingPlan: false,
        hasScenePlan: true, // even if a plan was somehow fetched, approval still gates
      }),
    ).toBe("awaiting_story_approval");
  });

  it("treats rejected/expired as a terminal, non-progressing state", () => {
    expect(
      deriveStudioStage({
        isGeneratingStory: false,
        reviewStatus: "rejected",
        isLoadingPlan: false,
        hasScenePlan: false,
      }),
    ).toBe("story_rejected");
  });

  it("moves to ready_for_media once approved and the plan preview has loaded", () => {
    expect(
      deriveStudioStage({
        isGeneratingStory: false,
        reviewStatus: "approved",
        isLoadingPlan: false,
        hasScenePlan: true,
      }),
    ).toBe("ready_for_media");
  });

  it("is generating_media once a graphId exists and any job is non-terminal", () => {
    expect(
      deriveStudioStage({
        isGeneratingStory: false,
        reviewStatus: "approved",
        isLoadingPlan: false,
        hasScenePlan: true,
        graphId: "graph-1",
        jobs: [job({ status: "rendering" }), job({ id: "j2", status: "ready" })],
      }),
    ).toBe("generating_media");
  });

  it("is media_partial once all jobs are terminal but at least one failed", () => {
    expect(
      deriveStudioStage({
        isGeneratingStory: false,
        reviewStatus: "approved",
        isLoadingPlan: false,
        hasScenePlan: true,
        graphId: "graph-1",
        jobs: [job({ status: "ready" }), job({ id: "j2", status: "failed" })],
      }),
    ).toBe("media_partial");
  });

  it("is ready_for_publish only when all jobs are ready AND readiness confirms completeness", () => {
    expect(
      deriveStudioStage({
        isGeneratingStory: false,
        reviewStatus: "approved",
        isLoadingPlan: false,
        hasScenePlan: true,
        graphId: "graph-1",
        jobs: [job({ status: "ready" }), job({ id: "j2", status: "ready" })],
        readiness: readiness(),
      }),
    ).toBe("ready_for_publish");
  });

  it("stays media_ready when jobs are all ready but readiness hasn't confirmed yet", () => {
    expect(
      deriveStudioStage({
        isGeneratingStory: false,
        reviewStatus: "approved",
        isLoadingPlan: false,
        hasScenePlan: true,
        graphId: "graph-1",
        jobs: [job({ status: "ready" })],
        readiness: undefined,
      }),
    ).toBe("media_ready");
  });
});
