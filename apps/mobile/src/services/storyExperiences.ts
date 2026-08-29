import { publishedStoryExperienceSchema, type PublishedStoryExperience } from "@adaptive/media-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

// Distinguishes "legitimately nothing published yet" from "we couldn't ask" --
// callers that only need the list (App.tsx) can flatten this to
// `.experiences`, but the distinction is preserved for development/debugging
// rather than collapsed into a single empty array.
export type LoadPublishedStoryExperiencesResult =
  | { status: "not_configured"; experiences: PublishedStoryExperience[] }
  | { status: "fetch_error"; reason: string; experiences: PublishedStoryExperience[] }
  | { status: "ok"; experiences: PublishedStoryExperience[]; droppedCount: number };

export async function loadPublishedStoryExperiences(
  supabase: SupabaseClient<Database> | null,
): Promise<LoadPublishedStoryExperiencesResult> {
  if (!supabase) return { status: "not_configured", experiences: [] };

  const { data, error } = await supabase
    .from("published_story_experiences")
    .select("story_id, published_version, experience")
    .order("story_id", { ascending: true })
    .order("published_version", { ascending: false });

  if (error) {
    console.error("[storyExperiences] failed to fetch published_story_experiences", error);
    return { status: "fetch_error", reason: error.message, experiences: [] };
  }

  const latestById = new Map<string, PublishedStoryExperience>();
  let droppedCount = 0;
  for (const row of data) {
    if (latestById.has(row.story_id)) continue; // already have the latest published_version
    const parsed = publishedStoryExperienceSchema.safeParse(row.experience);
    if (!parsed.success) {
      console.error(
        `[storyExperiences] dropped malformed published experience for story "${row.story_id}"`,
        parsed.error,
      );
      droppedCount += 1;
      continue;
    }
    latestById.set(row.story_id, parsed.data);
  }

  return { status: "ok", experiences: [...latestById.values()], droppedCount };
}

export async function loadPublishedStoryExperience(
  supabase: SupabaseClient<Database> | null,
  storyId: string,
): Promise<PublishedStoryExperience | undefined> {
  const result = await loadPublishedStoryExperiences(supabase);
  return result.experiences.find((experience) => experience.storyId === storyId);
}
