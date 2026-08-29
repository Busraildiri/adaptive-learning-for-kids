import { describe, expect, it, vi } from "vitest";

// A hand-authored fixture, not a bundled catalog story: every bundled
// "mino-*" demo story has more than one decision-capable step (some with
// more than two choices), which Phase 2's MVP scene planner deliberately
// rejects (UnsupportedMultipleDecisionPointsError /
// UnsupportedDecisionOptionCountError). This mirrors the exact shape Phase
// 2's own scenePlanner.test.ts fixtures use, and also stands in for the
// realistic Phase 5 case: a content-agent-generated story resolved via
// published_story_versions, not the static bundle.
const fixtureStory = {
  id: "fixture-story",
  version: 1,
  title: "Fixture Hikaye",
  ageBands: ["2-4"],
  targetSkills: ["emotion_recognition"],
  greetingTemplate: "Merhaba!",
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

vi.mock("../../../../../../lib/adminAuth", () => ({
  requireContentAdminSession: vi.fn(async () => ({ userId: "admin-1", client: fakeClient })),
  requiredEnvironment: (name: string) => `test-${name}`,
}));

describe("POST /api/media/jobs/story/plan", () => {
  it("returns a plan without persisting a graph or creating media jobs", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/media/jobs/story/plan", {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: JSON.stringify({ storyId: "fixture-story" }),
    });

    const response = await POST(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.graph).toBeDefined();
    expect(body.scenes).toBeDefined();
    // The persisting route (/story) returns graphId/jobs; this preview
    // route's response shape deliberately never carries either -- the
    // clearest black-box signal that nothing was written.
    expect(body.graphId).toBeUndefined();
    expect(body.jobs).toBeUndefined();
  });

  it("rejects a request with no storyId", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/media/jobs/story/plan", {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
