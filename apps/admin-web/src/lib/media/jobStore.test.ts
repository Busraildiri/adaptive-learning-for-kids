import { describe, expect, it } from "vitest";
import { filterJobsByGraph, finalizeStoryPublication } from "./jobStore";
import type { MediaJob } from "./types";

function job(overrides: Partial<MediaJob>): MediaJob {
  return {
    id: overrides.id ?? "job-1",
    storyId: "story-1",
    provider: "openmontage",
    mode: "local_animation",
    renderManifest: {
      scene: {},
      mode: "local_animation",
      aspectRatio: "4:5",
    } as unknown as MediaJob["renderManifest"],
    mediaKind: "video",
    status: "queued",
    progress: 0,
    requestedBy: "admin-1",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterJobsByGraph", () => {
  it("keeps only jobs belonging to the requested graph", () => {
    const jobs = [
      job({ id: "a", graphId: "graph-1" }),
      job({ id: "b", graphId: "graph-2" }),
      job({ id: "c", graphId: "graph-1" }),
    ];
    expect(filterJobsByGraph(jobs, "graph-1").map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("excludes legacy single-scene jobs (graphId undefined)", () => {
    const jobs = [job({ id: "legacy", graphId: undefined }), job({ id: "a", graphId: "graph-1" })];
    expect(filterJobsByGraph(jobs, "graph-1").map((item) => item.id)).toEqual(["a"]);
  });

  it("returns an empty list for a graph with no jobs", () => {
    const jobs = [job({ id: "a", graphId: "graph-1" })];
    expect(filterJobsByGraph(jobs, "graph-9")).toEqual([]);
  });
});

function validExperience() {
  return {
    storyId: "story-1",
    storyVersion: 1,
    publishedVersion: 1,
    experienceType: "video_branching",
    title: "T",
    greetingTemplate: "Merhaba!",
    ageBands: ["2-4"],
    startClipId: "intro",
    publishedAt: "2026-08-28T00:00:00.000Z",
    clips: [
      {
        kind: "ending",
        id: "intro",
        video: { mediaRef: "stories/story-1/fp/intro.mp4", durationMs: 4000 },
      },
    ],
  };
}

function fakeRpcClient(response: unknown) {
  return { rpc: async () => ({ data: response, error: null }) } as unknown as Parameters<
    typeof finalizeStoryPublication
  >[0];
}

describe("finalizeStoryPublication", () => {
  it("returns the parsed experience when the RPC's payload is well-formed", async () => {
    const client = fakeRpcClient({
      publicationId: "pub-1",
      status: "published",
      publishedVersion: 1,
      publishedAt: "2026-08-28T00:00:00.000Z",
      experience: validExperience(),
    });
    const result = await finalizeStoryPublication(client, "pub-1", "admin-1", [
      "stories/story-1/fp/intro.mp4",
    ]);
    expect(result.experience.storyId).toBe("story-1");
  });

  it("throws rather than returning an experience payload that fails the shared schema", async () => {
    const malformed = { ...validExperience(), storage_path: "media-renders/story-1/intro.mp4" };
    const client = fakeRpcClient({
      publicationId: "pub-1",
      status: "published",
      publishedVersion: 1,
      publishedAt: "2026-08-28T00:00:00.000Z",
      experience: malformed,
    });
    await expect(
      finalizeStoryPublication(client, "pub-1", "admin-1", ["stories/story-1/fp/intro.mp4"]),
    ).rejects.toThrow();
  });
});
