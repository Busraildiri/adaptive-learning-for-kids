/**
 * Turns an opaque, published mediaRef into a short-lived signed URL.
 * mediaRef is never parsed or constructed into a path -- it is passed
 * straight through to Storage. Always signs against the one published
 * bucket; never accepts a caller-supplied bucket name. Signed URLs are
 * cached in memory only (never persisted) for the resolver's lifetime,
 * and re-signed once within a safety margin of expiry.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";

const PUBLISHED_STORY_MEDIA_BUCKET = "published-story-media";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

export interface PublishedMediaResolver {
  resolvePublishedMediaRef: (mediaRef: string) => Promise<string>;
}

export function createPublishedMediaResolver(
  supabase: SupabaseClient<Database>,
): PublishedMediaResolver {
  const cache = new Map<string, CachedSignedUrl>();

  async function resolvePublishedMediaRef(mediaRef: string): Promise<string> {
    const cached = cache.get(mediaRef);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const { data, error } = await supabase.storage
      .from(PUBLISHED_STORY_MEDIA_BUCKET)
      .createSignedUrl(mediaRef, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Failed to sign published media reference "${mediaRef}": ${error?.message ?? "no URL returned"}`,
      );
    }

    cache.set(mediaRef, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - EXPIRY_SAFETY_MARGIN_MS,
    });
    return data.signedUrl;
  }

  return { resolvePublishedMediaRef };
}
