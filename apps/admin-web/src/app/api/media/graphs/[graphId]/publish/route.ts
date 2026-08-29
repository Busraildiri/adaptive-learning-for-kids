import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../../lib/adminAuth";
import {
  failStoryPublication,
  finalizeStoryPublication,
  prepareStoryPublication,
  type PublicationManifestEntry,
} from "../../../../../../lib/media/jobStore";

export const runtime = "nodejs";

const SOURCE_BUCKET = process.env.MEDIA_WORKER_STORAGE_BUCKET?.trim() || "media-renders";
const PUBLISHED_BUCKET = "published-story-media";

function contentTypeFor(entry: PublicationManifestEntry): string {
  return entry.kind === "audio" ? "audio/mp4" : "video/mp4";
}

/**
 * Orchestrates the three-stage publish protocol from the admin side --
 * PREPARE and FINALIZE are DB-only (delegated to the RPCs); COPY cannot
 * participate in that transaction (Supabase Storage is a separate
 * service), so it happens here, between the two calls, using download +
 * upload rather than a same-request cross-bucket .copy() call to avoid
 * depending on a specific storage-js version's cross-bucket support.
 *
 * If any copy fails, the publication is explicitly marked 'failed' and is
 * never finalized -- it stays invisible to mobile by construction (the
 * published_story_experiences view and the Storage RLS policy both key
 * off status = 'published').
 */
export async function POST(request: Request, { params }: { params: Promise<{ graphId: string }> }) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    const { userId } = await requireContentAdminSession(request, supabaseUrl, publishableKey);

    const { graphId } = await params;
    if (!graphId.trim()) throw new Error("Geçersiz graphId.");

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const prepared = await prepareStoryPublication(serviceClient, graphId.trim(), userId);

    if (prepared.status === "published") {
      // Idempotent short-circuit: this exact snapshot is already live.
      return NextResponse.json({ status: "published", publicationId: prepared.publicationId });
    }

    const confirmedPaths: string[] = [];
    try {
      for (const entry of prepared.copyManifest) {
        const { data: file, error: downloadError } = await serviceClient.storage
          .from(SOURCE_BUCKET)
          .download(entry.sourcePath);
        if (downloadError || !file) {
          throw new Error(downloadError?.message ?? `kaynak dosya indirilemedi: ${entry.sourcePath}`);
        }
        const { error: uploadError } = await serviceClient.storage
          .from(PUBLISHED_BUCKET)
          .upload(entry.destPath, file, { upsert: true, contentType: contentTypeFor(entry) });
        if (uploadError) throw new Error(uploadError.message);
        confirmedPaths.push(entry.destPath);
      }
    } catch (copyError) {
      const reason = copyError instanceof Error ? copyError.message : "Medya kopyalanamadı.";
      await failStoryPublication(serviceClient, prepared.publicationId, userId, reason);
      return NextResponse.json(
        { status: "failed", publicationId: prepared.publicationId, error: reason },
        { status: 502 },
      );
    }

    const finalized = await finalizeStoryPublication(
      serviceClient,
      prepared.publicationId,
      userId,
      confirmedPaths,
    );

    return NextResponse.json(finalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Yayınlama başlatılamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
