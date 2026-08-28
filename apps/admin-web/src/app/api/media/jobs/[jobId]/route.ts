import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../lib/adminAuth";
import { getMediaJob } from "../../../../../lib/media/jobStore";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const { client } = await requireContentAdminSession(request, supabaseUrl, publishableKey);

    const { jobId } = await params;
    const job = await getMediaJob(client, jobId);
    if (!job) return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 });
    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "İş sorgulanamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
