import { describe, expect, it, vi } from "vitest";
import type { MediaJob } from "../../../../../../lib/media/types";

vi.mock("../../../../../../lib/adminAuth", () => ({
  requireContentAdminSession: vi.fn(async () => ({ userId: "admin-1", client: {} })),
  requiredEnvironment: (name: string) => `test-${name}`,
}));

function job(id: string, graphId: string | undefined): MediaJob {
  return {
    id,
    storyId: "story-1",
    graphId,
    provider: "openmontage",
    mode: "local_animation",
    renderManifest: { scene: {}, mode: "local_animation", aspectRatio: "4:5" } as unknown as MediaJob["renderManifest"],
    mediaKind: "video",
    status: "queued",
    progress: 0,
    requestedBy: "admin-1",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };
}

const allJobs: MediaJob[] = [
  job("a", "graph-1"),
  job("b", "graph-2"),
  job("c", "graph-1"),
  job("legacy", undefined),
];

// Only the Supabase-touching half (listMediaJobs, called deep inside
// listMediaJobsForGraph) needs stubbing -- the actual filterJobsByGraph
// pure function runs for real here, so this test exercises real filtering
// logic against fixture data instead of re-describing it.
vi.mock("../../../../../../lib/media/jobStore", async () => {
  const actual = await vi.importActual<typeof import("../../../../../../lib/media/jobStore")>(
    "../../../../../../lib/media/jobStore",
  );
  return {
    ...actual,
    listMediaJobsForGraph: vi.fn(async (_client: unknown, graphId: string) =>
      actual.filterJobsByGraph(allJobs, graphId),
    ),
  };
});

describe("GET /api/media/graphs/[graphId]/jobs", () => {
  it("returns only jobs belonging to the requested graph", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ graphId: "graph-1" }),
    });
    const body = (await response.json()) as { jobs: MediaJob[] };

    expect(response.status).toBe(200);
    expect(body.jobs.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("never includes a sibling graph's or a legacy job's row", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ graphId: "graph-2" }),
    });
    const body = (await response.json()) as { jobs: MediaJob[] };
    expect(body.jobs.map((item) => item.id)).toEqual(["b"]);
  });

  it("rejects an empty graphId", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ graphId: "  " }),
    });
    expect(response.status).toBe(400);
  });
});
