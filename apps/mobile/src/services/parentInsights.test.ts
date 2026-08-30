import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  synchronizePendingInteractionEvents: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}));

vi.mock("./interactionEvents", () => ({
  synchronizePendingInteractionEvents: mocks.synchronizePendingInteractionEvents,
}));

vi.mock("./consents", () => ({
  loadChildConsentSettings: vi.fn(),
}));

const childId = "11111111-1111-4111-8111-111111111111";
const emptyEvidence = {
  schemaVersion: 2,
  childId,
  consentEnabled: false,
  source: "consented_session_event_projection",
  storyEvidence: [],
  gameEvidence: [],
  profileContext: {
    nickname: "Sude",
    ageBand: "2-4",
    personalizationEnabled: false,
    favoriteAnimals: [],
    favoriteToys: [],
    interests: [],
    profileUpdatedAt: "2026-08-30T00:00:00.000Z",
  },
  retrievedAt: "2026-08-30T00:00:00.000Z",
  retrievalPolicyVersion: "parent-insight-retrieval-v2",
};

describe("loadParentSessionSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the stored summary even when pending event synchronization fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.synchronizePendingInteractionEvents.mockRejectedValueOnce(new Error("offline"));
    mocks.rpc.mockResolvedValueOnce({ data: emptyEvidence, error: null });

    const { loadParentSessionSummary } = await import("./parentInsights");
    const summary = await loadParentSessionSummary(childId);

    expect(summary.status).toBe("consent_required");
    expect(mocks.rpc).toHaveBeenCalledWith("get_personalized_parent_insight_evidence", {
      child_profile_id: childId,
    });
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
