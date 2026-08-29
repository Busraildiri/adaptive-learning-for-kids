import {
  type Asset,
  contentVersionSchema,
  type Story,
  storySchema,
} from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface StoryLookupResult {
  story: Story;
  assets: Asset[];
}

/** Resolves a Story for media planning/generation. Content-agent-generated
 * variants (the normal Phase 5 case: a story approved through
 * content_review_queue) live in public.published_story_versions, not the
 * static bundled catalog -- that table is readable by any authenticated
 * admin session (existing RLS policy, no new grant needed). Falls back to
 * the bundled catalog for the handful of legacy/demo stories that were
 * never generated through content-agent. The asset catalog itself is
 * always the bundled one -- assets are a fixed content resource, not
 * something generated per-story. */
export async function findStoryForMedia(
  client: SupabaseClient,
  storyId: string,
): Promise<StoryLookupResult> {
  const content = contentVersionSchema.parse(contentJson);

  const { data, error } = await client
    .from("published_story_versions")
    .select("story")
    .eq("story_id", storyId)
    .order("story_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.story) {
    return { story: storySchema.parse(data.story), assets: content.assets };
  }

  const bundled = content.stories.find((candidate) => candidate.id === storyId);
  if (!bundled) throw new Error("Hikaye bulunamadı.");
  return { story: bundled, assets: content.assets };
}
