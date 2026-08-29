import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";
import { createPublishedMediaResolver } from "./mediaResolver";

function fakeSupabase() {
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: { signedUrl: `https://example.test/signed/${path}` },
    error: null,
  }));
  const fromSpy = vi.fn((bucket: string) => ({ createSignedUrl }));
  const supabase = { storage: { from: fromSpy } } as unknown as SupabaseClient<Database>;
  return { supabase, fromSpy, createSignedUrl };
}

describe("createPublishedMediaResolver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("always signs against the published-story-media bucket, never a caller-chosen one", async () => {
    const { supabase, fromSpy } = fakeSupabase();
    const { resolvePublishedMediaRef } = createPublishedMediaResolver(supabase);
    await resolvePublishedMediaRef("stories/story-1/clip.mp4");
    expect(fromSpy).toHaveBeenCalledWith("published-story-media");
  });

  it("caches a signed URL and avoids repeated signing for the same mediaRef", async () => {
    const { supabase, createSignedUrl } = fakeSupabase();
    const { resolvePublishedMediaRef } = createPublishedMediaResolver(supabase);
    const first = await resolvePublishedMediaRef("clip.mp4");
    const second = await resolvePublishedMediaRef("clip.mp4");
    expect(first).toBe(second);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("re-signs a cached URL once it is within the expiry safety margin", async () => {
    const { supabase, createSignedUrl } = fakeSupabase();
    const { resolvePublishedMediaRef } = createPublishedMediaResolver(supabase);
    await resolvePublishedMediaRef("clip.mp4");
    // TTL is 1h, safety margin 5m -- 56 minutes in is inside the margin.
    vi.advanceTimersByTime(56 * 60 * 1000);
    await resolvePublishedMediaRef("clip.mp4");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("surfaces a signing failure as a rejected promise, not a silent empty URL", async () => {
    const supabase = {
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: null, error: { message: "denied" } }),
        }),
      },
    } as unknown as SupabaseClient<Database>;
    const { resolvePublishedMediaRef } = createPublishedMediaResolver(supabase);
    await expect(resolvePublishedMediaRef("clip.mp4")).rejects.toThrow();
  });
});
