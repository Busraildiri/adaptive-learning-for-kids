import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../../lib/adminAuth";
import { listMediaJobsForGraph } from "../../../../../../lib/media/jobStore";

export const runtime = "nodejs";

// Read-only support for the Studio's media-production polling (Phase 5).
// No new render/job-creation semantics: this filters the existing
// authorized list_media_jobs() result down to one graph, server-side, so
// the browser never downloads every admin's entire job history just to
// watch one story's production.
export async function GET(request: Request, { params }: { params: Promise<{ graphId: string }> }) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const { client } = await requireContentAdminSession(request, supabaseUrl, publishableKey);

    const { graphId } = await params;
    if (!graphId.trim()) throw new Error("Geçersiz graphId.");

    return NextResponse.json({ jobs: await listMediaJobsForGraph(client, graphId.trim()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşler listelenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
