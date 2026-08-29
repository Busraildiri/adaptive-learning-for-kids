import { NextResponse } from "next/server";
import { requireContentAdminSession, requiredEnvironment } from "../../../../../../lib/adminAuth";
import { planStoryPlayback } from "../../../../../../lib/media/scenePlanner";
import { findStoryForMedia } from "../../../../../../lib/media/storyLookup";

export const runtime = "nodejs";

// Preview-only: runs the exact same canonical Phase 2 planStoryPlayback()
// as POST /api/media/jobs/story, but persists nothing -- no
// createStoryPlaybackGraph call, no createMediaJob calls. Lets the Studio
// show the Scene/Branch Plan before the admin commits to Generate Media.
// planStoryPlayback is a pure function of the approved Story, so calling it
// again (unpersisted) here and then for real in /story is deterministic and
// safe -- this is not a second planner implementation.
export async function POST(request: Request) {
  try {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const { client } = await requireContentAdminSession(request, supabaseUrl, publishableKey);

    const body = (await request.json()) as { storyId?: unknown };
    if (typeof body.storyId !== "string" || !body.storyId.trim()) {
      throw new Error("Geçersiz storyId.");
    }

    const { story, assets } = await findStoryForMedia(client, body.storyId.trim());
    const plan = planStoryPlayback(story, { assetCatalog: assets });

    return NextResponse.json({ graph: plan.graph, scenes: plan.scenes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sahne planı oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
