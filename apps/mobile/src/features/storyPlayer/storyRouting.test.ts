import type { Story } from "@adaptive/content-schema";
import type { PublishedStoryExperience } from "@adaptive/media-schema";
import { describe, expect, it, vi } from "vitest";
import { resolveStoryRoute } from "./storyRouting";

function bundledStory(id: string): Story {
  return { id } as Story;
}

function publishedExperience(storyId: string): PublishedStoryExperience {
  return {
    storyId,
    storyVersion: 1,
    publishedVersion: 1,
    experienceType: "video_branching",
    title: "Test",
    greetingTemplate: "Merhaba {{childName}}",
    ageBands: ["4-7"],
    startClipId: "scene-01",
    publishedAt: "2026-01-01T00:00:00.000Z",
    clips: [{ kind: "ending", id: "scene-01", video: { mediaRef: "a.mp4", durationMs: 1000 } }],
  };
}

describe("resolveStoryRoute", () => {
  it("routes a bundled-only storyId to MinoStory", () => {
    const route = resolveStoryRoute("mino-balloon-story", [bundledStory("mino-balloon-story")], []);
    expect(route.kind).toBe("bundled");
  });

  it("routes a published-only storyId to StoryPlayer", () => {
    const route = resolveStoryRoute("remote-story", [], [publishedExperience("remote-story")]);
    expect(route.kind).toBe("published");
  });

  it("returns none for an id in neither catalog", () => {
    expect(resolveStoryRoute("missing", [], [])).toEqual({ kind: "none" });
  });

  it("returns none when storyId is null", () => {
    expect(resolveStoryRoute(null, [bundledStory("a")], [])).toEqual({ kind: "none" });
  });

  it("keeps the bundled story on a collision and logs a warning, never silently replacing it", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const route = resolveStoryRoute(
      "shared-id",
      [bundledStory("shared-id")],
      [publishedExperience("shared-id")],
    );
    expect(route.kind).toBe("bundled");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
