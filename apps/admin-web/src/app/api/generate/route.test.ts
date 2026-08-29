import type { Story } from "@adaptive/content-schema";
import { describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test-key";

const supabaseStub = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } }, error: null })) },
  rpc: vi.fn(async (name: string) => {
    if (name === "is_content_admin") return { data: true, error: null };
    if (name === "record_content_generation_run") return { data: null, error: null };
    return { data: null, error: null };
  }),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => supabaseStub),
}));

// generateStoryDraft/routeGenerationResult are mocked so this test exercises
// only the route's own wiring (does it call the compatibility gate, does it
// respect the verdict) -- content-agent's own safety/mechanic-preservation
// behavior is covered by packages/content-agent's own test suite, not
// re-verified here.
const { generateStoryDraft, routeGenerationResult } = vi.hoisted(() => ({
  generateStoryDraft: vi.fn(),
  routeGenerationResult: vi.fn(async () => ({ status: "queued_for_review", requestId: "req-1" })),
}));

vi.mock("@adaptive/content-agent", async () => {
  const actual =
    await vi.importActual<typeof import("@adaptive/content-agent")>("@adaptive/content-agent");
  return {
    ...actual,
    generateStoryDraft,
    routeGenerationResult,
    createOpenAIContentModelsFromEnv: () => ({
      generator: { model: "fake-generator", generateJson: vi.fn() },
      supervisor: { model: "fake-supervisor", generateJson: vi.fn() },
    }),
    createSupabasePublicationSink: () => ({ publish: vi.fn(), enqueueReview: vi.fn() }),
  };
});

function draftResultFor(story: Story) {
  return {
    status: "draft" as const,
    draft: story,
    audit: {
      requestId: "req-1",
      storyId: story.id,
      status: "draft" as const,
      generatorModel: "fake",
      supervisorModel: "fake",
      promptHash: "fake-hash",
      schemaVersion: "content-agent-v1" as const,
      safetyRulesVersion: "story-safety-tr-v1" as const,
      guidanceVersion: "test",
      rejectionReasons: [] as never[],
      generatedStoryVersion: story.version,
      createdAt: "2026-08-28T00:00:00.000Z",
    },
  };
}

function videoBranchingStory(overrides: Partial<Story>): Story {
  return {
    id: "draft-story",
    version: 1,
    title: "Taslak",
    ageBands: ["2-4"],
    targetSkills: ["patience"],
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
          { id: "a", action: "hug", accessibilityLabel: "Sarıl", resultNarration: "Sarıldı." },
          {
            id: "b",
            action: "breathe",
            accessibilityLabel: "Nefes al",
            resultNarration: "Nefes aldı.",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function requestBody(flowId: string) {
  return {
    flowId,
    theme: "Yeni bir tema",
    targetEmotion: "sad",
    sceneAssetId: "scene-shared-crayons",
    flowAssetIds: ["character-mino-happy", "character-mino-sad"],
    ageBands: ["2-4"],
    sendToReview: true,
  };
}

function request(flowId: string) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify(requestBody(flowId)),
  });
}

describe("POST /api/generate -- Phase 5.5 video_branching pre-review gate", () => {
  it("a compatible video_branching draft reaches routeGenerationResult normally", async () => {
    routeGenerationResult.mockClear();
    generateStoryDraft.mockImplementation(async (input) => {
      const result = draftResultFor(videoBranchingStory({}));
      await input.auditSink.save(result.audit);
      return result;
    });

    const { POST } = await import("./route");
    const response = await POST(request("share-and-take-turns"));
    const body = (await response.json()) as { status?: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("queued_for_review");
    expect(routeGenerationResult).toHaveBeenCalledTimes(1);
  });

  it("an incompatible video_branching draft (two decision points) never reaches routeGenerationResult", async () => {
    routeGenerationResult.mockClear();
    generateStoryDraft.mockImplementation(async (input) => {
      const badStory = videoBranchingStory({
        steps: [
          { id: "intro", type: "event", narration: "Bir olay oldu." },
          {
            id: "help_01",
            type: "help_choice",
            prompt: "Nasıl yardım edelim?",
            choices: [
              { id: "a", action: "hug", accessibilityLabel: "Sarıl", resultNarration: "Sarıldı." },
              {
                id: "b",
                action: "breathe",
                accessibilityLabel: "Nefes al",
                resultNarration: "Nefes aldı.",
              },
            ],
          },
          {
            id: "help_02",
            type: "help_choice",
            prompt: "Bir daha nasıl yardım edelim?",
            choices: [
              {
                id: "c",
                action: "hug",
                accessibilityLabel: "Tekrar sarıl",
                resultNarration: "Tekrar sarıldı.",
              },
              {
                id: "d",
                action: "breathe",
                accessibilityLabel: "Tekrar nefes al",
                resultNarration: "Tekrar nefes aldı.",
              },
            ],
          },
        ],
      });
      const result = draftResultFor(badStory);
      await input.auditSink.save(result.audit);
      return result;
    });

    const { POST } = await import("./route");
    const response = await POST(request("share-and-take-turns"));
    const body = (await response.json()) as { status?: string; rejectionReasons?: string[] };

    expect(response.status).toBe(200);
    expect(body.status).toBe("not_publishable");
    expect(body.rejectionReasons).toContain("video_branching_topology_incompatible");
    expect(routeGenerationResult).not.toHaveBeenCalled();
  });

  it("an interactive_ui draft is never checked against the video_branching gate", async () => {
    routeGenerationResult.mockClear();
    generateStoryDraft.mockImplementation(async (input) => {
      // Deliberately bad topology (two decision points) -- must not matter,
      // the gate only ever applies to experienceType === "video_branching".
      const interactiveStory = videoBranchingStory({
        experienceType: "interactive_ui",
        steps: [
          { id: "intro", type: "event", narration: "Bir olay oldu." },
          {
            id: "help_01",
            type: "help_choice",
            prompt: "Nasıl yardım edelim?",
            choices: [
              { id: "a", action: "hug", accessibilityLabel: "Sarıl", resultNarration: "Sarıldı." },
              {
                id: "b",
                action: "breathe",
                accessibilityLabel: "Nefes al",
                resultNarration: "Nefes aldı.",
              },
            ],
          },
          {
            id: "help_02",
            type: "help_choice",
            prompt: "Bir daha nasıl yardım edelim?",
            choices: [
              {
                id: "c",
                action: "hug",
                accessibilityLabel: "Tekrar sarıl",
                resultNarration: "Tekrar sarıldı.",
              },
              {
                id: "d",
                action: "breathe",
                accessibilityLabel: "Tekrar nefes al",
                resultNarration: "Tekrar nefes aldı.",
              },
            ],
          },
        ],
      });
      const result = draftResultFor(interactiveStory);
      await input.auditSink.save(result.audit);
      return result;
    });

    const { POST } = await import("./route");
    const response = await POST(request("lost-and-found"));
    const body = (await response.json()) as { status?: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("queued_for_review");
    expect(routeGenerationResult).toHaveBeenCalledTimes(1);
  });
});
