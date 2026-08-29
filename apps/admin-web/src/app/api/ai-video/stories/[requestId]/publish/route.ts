import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../../lib/adminAuth";
import { describeUnknownError } from "../../../../../../lib/apiError";

export const runtime = "nodejs";

interface PublicationManifestEntry {
  kind: "video" | "audio";
  sourcePath: string;
  destPath: string;
}

interface PreparedPublication {
  publicationId: string;
  status: "preparing" | "published";
  copyManifest: PublicationManifestEntry[];
}

function contentType(entry: PublicationManifestEntry): string {
  return entry.kind === "video" ? "video/mp4" : "audio/wav";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  let stage = "publication_session";
  let publicationId: string | null = null;
  let actorId: string | null = null;
  const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const session = await requireContentAdminSession(request, supabaseUrl, publishableKey);
    actorId = session.userId;
    const { requestId } = await params;
    if (!/^[0-9a-f-]{36}$/iu.test(requestId)) throw new Error("Geçersiz üretim isteği kimliği.");

    stage = "publication_prepare";
    const preparedResult = await serverClient.rpc("prepare_ai_video_story_publication", {
      target_request_id: requestId,
      target_actor_id: session.userId,
    });
    if (preparedResult.error) throw preparedResult.error;
    const prepared = preparedResult.data as PreparedPublication;
    publicationId = prepared.publicationId;

    stage = "publication_copy";
    const confirmedPaths: string[] = [];
    for (const entry of prepared.copyManifest ?? []) {
      const downloaded = await serverClient.storage
        .from("media-renders")
        .download(entry.sourcePath);
      if (downloaded.error) throw downloaded.error;
      const uploaded = await serverClient.storage
        .from("published-story-media")
        .upload(entry.destPath, downloaded.data, { contentType: contentType(entry), upsert: true });
      if (uploaded.error) throw uploaded.error;
      confirmedPaths.push(entry.destPath);
    }

    stage = "publication_finalize";
    const finalizedResult = await serverClient.rpc("finalize_ai_video_story_publication", {
      target_publication_id: prepared.publicationId,
      target_actor_id: session.userId,
      confirmed_object_paths: confirmedPaths,
    });
    if (finalizedResult.error) throw finalizedResult.error;
    return NextResponse.json(finalizedResult.data);
  } catch (error) {
    const failure = describeUnknownError(error, "Hikâye uygulamada paylaşılamadı.");
    if (publicationId && actorId && stage !== "publication_prepare") {
      await serverClient.rpc("fail_story_publication", {
        target_publication_id: publicationId,
        actor_id: actorId,
        reason: failure.message.slice(0, 1_000),
      });
    }
    return NextResponse.json({ error: failure.message, ...failure, stage }, { status: 400 });
  }
}
