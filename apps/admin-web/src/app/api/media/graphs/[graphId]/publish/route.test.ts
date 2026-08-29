import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../lib/adminAuth", () => ({
  requireContentAdminSession: vi.fn(async () => ({ userId: "admin-1", client: {} })),
  requiredEnvironment: (name: string) => `test-${name}`,
}));

const { prepareStoryPublication, failStoryPublication, finalizeStoryPublication } = vi.hoisted(
  () => ({
    prepareStoryPublication: vi.fn(),
    failStoryPublication: vi.fn(async () => {}),
    finalizeStoryPublication: vi.fn(async () => ({
      publicationId: "pub-1",
      status: "published" as const,
      publishedVersion: 1,
      publishedAt: "2026-08-29T00:00:00.000Z",
      experience: { storyId: "story-1" },
    })),
  }),
);

vi.mock("../../../../../../lib/media/jobStore", () => ({
  prepareStoryPublication,
  failStoryPublication,
  finalizeStoryPublication,
}));

// A single, mutable storage stub shared across the test file -- each test
// reconfigures `storageBehavior` before calling POST, rather than
// re-mocking the module per test (dynamic import() caches the module after
// its first evaluation, so a per-test vi.doMock would silently only ever
// apply to the first test that imports the route).
const storageBehavior = {
  download: async (
    _bucket: string,
    _path: string,
  ): Promise<{ data: unknown; error: { message: string } | null }> => ({
    data: new Blob(["x"]),
    error: null,
  }),
  upload: async (
    _bucket: string,
    _path: string,
  ): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from(bucket: string) {
        return {
          download: (path: string) => storageBehavior.download(bucket, path),
          upload: (path: string) => storageBehavior.upload(bucket, path),
        };
      },
    },
  }),
}));

function manifestEntry(destPath: string, sourcePath: string) {
  return {
    kind: "video" as const,
    clipId: "c",
    renderId: null,
    sourcePath,
    destPath,
    durationMs: 1000,
  };
}

describe("POST /api/media/graphs/[graphId]/publish", () => {
  it("copies exactly the prepared manifest and finalizes with those confirmed paths", async () => {
    storageBehavior.download = async () => ({ data: new Blob(["x"]), error: null });
    storageBehavior.upload = async () => ({ error: null });
    prepareStoryPublication.mockResolvedValueOnce({
      publicationId: "pub-1",
      status: "preparing",
      fingerprint: "fp-1",
      copyManifest: [manifestEntry("stories/story-1/fp-1/clips/a.mp4", "media-renders/a/r1.mp4")],
    });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ graphId: "graph-1" }),
    });
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("published");
    expect(finalizeStoryPublication).toHaveBeenCalledWith(expect.anything(), "pub-1", "admin-1", [
      "stories/story-1/fp-1/clips/a.mp4",
    ]);
    expect(failStoryPublication).not.toHaveBeenCalled();
  });

  it("short-circuits without copying or finalizing when already published", async () => {
    prepareStoryPublication.mockResolvedValueOnce({
      publicationId: "pub-2",
      status: "published",
      fingerprint: "fp-2",
      copyManifest: [],
    });
    finalizeStoryPublication.mockClear();

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ graphId: "graph-2" }),
    });
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("published");
    expect(finalizeStoryPublication).not.toHaveBeenCalled();
  });

  it("marks the publication failed and never finalizes when a copy fails", async () => {
    prepareStoryPublication.mockResolvedValueOnce({
      publicationId: "pub-3",
      status: "preparing",
      fingerprint: "fp-3",
      copyManifest: [manifestEntry("stories/story-1/fp-3/clips/a.mp4", "media-renders/a/r1.mp4")],
    });
    failStoryPublication.mockClear();
    finalizeStoryPublication.mockClear();
    storageBehavior.download = async () => ({ data: null, error: { message: "not found" } });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ graphId: "graph-3" }),
    });
    const body = (await response.json()) as { status: string; error: string };

    expect(response.status).toBe(502);
    expect(body.status).toBe("failed");
    expect(failStoryPublication).toHaveBeenCalledWith(
      expect.anything(),
      "pub-3",
      "admin-1",
      expect.any(String),
    );
    expect(finalizeStoryPublication).not.toHaveBeenCalled();
  });
});
