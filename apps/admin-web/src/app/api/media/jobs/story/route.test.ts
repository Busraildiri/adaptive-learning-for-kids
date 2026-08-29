import type { Story } from "@adaptive/content-schema";
import { contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it, vi } from "vitest";
import { planStoryPlayback } from "../../../../../lib/media/scenePlanner";

// A hand-authored fixture, not a bundled catalog story: every bundled
// "mino-*" demo story has more than one decision-capable step (some with
// more than two choices), which Phase 2's MVP scene planner deliberately
// rejects. This mirrors Phase 2's own scenePlanner.test.ts fixture shape,
// and also stands in for the realistic Phase 5 case: a content-agent-
// generated story resolved via published_story_versions, not the bundle.
const fixtureStory: Story = {
  id: "fixture-story",
  version: 1,
  title: "Fixture Hikaye",
  ageBands: ["2-4"],
  targetSkills: ["emotion_recognition"],
  greetingTemplate: "Merhaba!",
  experienceType: "video_branching",
  characterAssets: { happyAssetId: "character-mino-happy", sadAssetId: "character-mino-sad" },
  steps: [
    { id: "intro", type: "event", narration: "Bir olay oldu." },
    {
      id: "help_01",
      type: "help_choice",
      prompt: "Nasıl yardım edelim?",
      choices: [
        { id: "hug", action: "hug", accessibilityLabel: "Sarıl", resultNarration: "Sarıldı." },
        {
          id: "balloon",
          action: "new_balloon",
          accessibilityLabel: "Balon bul",
          resultNarration: "Balon buldu.",
        },
      ],
    },
  ],
};

const fakeClient = {
  from() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle: async () => ({ data: { story: fixtureStory }, error: null }),
    };
  },
};

vi.mock("../../../../../lib/adminAuth", () => ({
  requireContentAdminSession: vi.fn(async () => ({ userId: "admin-1", client: fakeClient })),
  requiredEnvironment: (name: string) => `test-${name}`,
}));

// vi.mock factories are hoisted above these consts, so the mock functions
// themselves must be created inside vi.hoisted() -- referencing an
// ordinary outer const from the factory would hit a temporal-dead-zone
// error at runtime.
const { createStoryPlaybackGraph, createMediaJob } = vi.hoisted(() => {
  let jobCounter = 0;
  return {
    createStoryPlaybackGraph: vi.fn(async () => "graph-123"),
    createMediaJob: vi.fn(async (_client: unknown, input: Record<string, unknown>) => {
      jobCounter += 1;
      return {
        id: `job-${jobCounter}`,
        status: "queued",
        ...input,
      };
    }),
  };
});

vi.mock("../../../../../lib/media/jobStore", () => ({
  createStoryPlaybackGraph,
  createMediaJob,
}));

describe("POST /api/media/jobs/story", () => {
  it("persists exactly one graph and one job per clip/audio asset from the real plan", async () => {
    const { POST } = await import("./route");

    const content = contentVersionSchema.parse(contentJson);
    const expectedPlan = planStoryPlayback(fixtureStory, { assetCatalog: content.assets });
    const expectedVideoJobs = expectedPlan.graph.clips.filter(
      (clip) => clip.kind !== "decision",
    ).length;
    const expectedAudioJobs = expectedPlan.graph.clips
      .filter(
        (clip): clip is Extract<typeof clip, { kind: "decision" }> => clip.kind === "decision",
      )
      .reduce((sum, clip) => sum + 1 + clip.choice.options.length, 0);

    const request = new Request("http://localhost/api/media/jobs/story", {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: JSON.stringify({ storyId: "fixture-story" }),
    });
    const response = await POST(request);
    const body = (await response.json()) as { graphId: string; jobs: unknown[] };

    expect(response.status).toBe(200);
    expect(createStoryPlaybackGraph).toHaveBeenCalledTimes(1);
    expect(body.graphId).toBe("graph-123");
    expect(createMediaJob).toHaveBeenCalledTimes(expectedVideoJobs + expectedAudioJobs);
    expect(body.jobs).toHaveLength(expectedVideoJobs + expectedAudioJobs);
  });
});
