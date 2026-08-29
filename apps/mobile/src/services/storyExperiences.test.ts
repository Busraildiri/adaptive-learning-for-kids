import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { loadPublishedStoryExperience, loadPublishedStoryExperiences } from "./storyExperiences";

type Row = { story_id: string; published_version: number; experience: unknown };

function fakeSupabase(response: { data: Row[] | null; error: { message: string } | null }) {
  const builder = {
    select: () => builder,
    order: () => builder,
    then: (resolve: (value: typeof response) => unknown) => resolve(response),
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

function validExperience(storyId: string, publishedVersion: number) {
  return {
    storyId,
    storyVersion: 1,
    publishedVersion,
    experienceType: "video_branching",
    title: "Mino ve Balon",
    greetingTemplate: "Merhaba {{childName}}",
    ageBands: ["4-7"],
    startClipId: "scene-01",
    publishedAt: "2026-01-01T00:00:00.000Z",
    clips: [{ kind: "ending", id: "scene-01", video: { mediaRef: "a.mp4", durationMs: 1000 } }],
  };
}

describe("loadPublishedStoryExperiences", () => {
  it("returns not_configured with an empty list when Supabase is not set up", async () => {
    const result = await loadPublishedStoryExperiences(null);
    expect(result).toEqual({ status: "not_configured", experiences: [] });
  });

  it("accepts a valid published payload", async () => {
    const supabase = fakeSupabase({
      data: [{ story_id: "story-1", published_version: 1, experience: validExperience("story-1", 1) }],
      error: null,
    });
    const result = await loadPublishedStoryExperiences(supabase);
    expect(result.status).toBe("ok");
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0]?.storyId).toBe("story-1");
  });

  it("drops a malformed row instead of throwing or surfacing raw JSON", async () => {
    const supabase = fakeSupabase({
      data: [{ story_id: "story-bad", published_version: 1, experience: { nonsense: true } }],
      error: null,
    });
    const result = await loadPublishedStoryExperiences(supabase);
    expect(result).toEqual({ status: "ok", experiences: [], droppedCount: 1 });
  });

  it("distinguishes a fetch/network failure from a legitimately empty catalog", async () => {
    const supabase = fakeSupabase({ data: null, error: { message: "network down" } });
    const result = await loadPublishedStoryExperiences(supabase);
    expect(result).toEqual({ status: "fetch_error", reason: "network down", experiences: [] });

    const emptySupabase = fakeSupabase({ data: [], error: null });
    const emptyResult = await loadPublishedStoryExperiences(emptySupabase);
    expect(emptyResult).toEqual({ status: "ok", experiences: [], droppedCount: 0 });
  });

  it("dedupes to the latest published_version per story", async () => {
    const supabase = fakeSupabase({
      data: [
        { story_id: "story-1", published_version: 2, experience: validExperience("story-1", 2) },
        { story_id: "story-1", published_version: 1, experience: validExperience("story-1", 1) },
      ],
      error: null,
    });
    const result = await loadPublishedStoryExperiences(supabase);
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0]?.publishedVersion).toBe(2);
  });
});

describe("loadPublishedStoryExperience", () => {
  it("finds a single experience by storyId", async () => {
    const supabase = fakeSupabase({
      data: [{ story_id: "story-1", published_version: 1, experience: validExperience("story-1", 1) }],
      error: null,
    });
    const experience = await loadPublishedStoryExperience(supabase, "story-1");
    expect(experience?.storyId).toBe("story-1");
  });

  it("returns undefined when no experience matches", async () => {
    const supabase = fakeSupabase({ data: [], error: null });
    const experience = await loadPublishedStoryExperience(supabase, "missing");
    expect(experience).toBeUndefined();
  });
});
