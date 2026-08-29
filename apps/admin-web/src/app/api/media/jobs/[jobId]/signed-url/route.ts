import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../../lib/adminAuth";
import { getMediaJob } from "../../../../../../lib/media/jobStore";

export const runtime = "nodejs";

// Short-lived: minted fresh on every request, never persisted. storage_path
// (durable) is the only thing that is ever stored -- this route is the one
// place a signed URL gets created for graph jobs.
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const STORAGE_BUCKET = process.env.MEDIA_WORKER_STORAGE_BUCKET?.trim() || "media-renders";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    // Session client only proves "this caller is a content admin" -- it has
    // no storage access itself (the bucket is private, deny-by-default).
    const { client } = await requireContentAdminSession(request, supabaseUrl, publishableKey);

    const { jobId } = await params;
    // storage_path is resolved server-side from the job row -- the client
    // never supplies (or can influence) an arbitrary storage path.
    const job = await getMediaJob(client, jobId);
    if (!job) return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 });
    if (!job.storagePath) {
      return NextResponse.json(
        { error: "Bu iş için henüz kalıcı bir storage yolu yok." },
        { status: 409 },
      );
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await serviceClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(job.storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data) throw new Error(error?.message ?? "İmzalı URL üretilemedi.");

    return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "İmzalı URL üretilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
