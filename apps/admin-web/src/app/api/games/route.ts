import { gameSchema } from "@adaptive/content-schema";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} sunucu ortam değişkeni eksik.`);
  return value;
}

async function requireContentAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Yönetici oturumu gerekli.");
  const token = authorization.slice("Bearer ".length);
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: userData, error: userError }, adminResult] = await Promise.all([
    client.auth.getUser(token),
    client.rpc("is_content_admin"),
  ]);
  if (userError || !userData.user || adminResult.error || !adminResult.data) {
    throw new Error("İçerik yöneticisi yetkisi gerekli.");
  }
  return userData.user.id;
}

async function authorizedGameClients(request: Request) {
  const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const adminId = await requireContentAdmin(request, supabaseUrl, publishableKey);
  return {
    adminId,
    serviceClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function GET(request: Request) {
  try {
    const { adminId, serviceClient } = await authorizedGameClients(request);
    const result = await serviceClient.rpc("list_game_catalog", { actor_id: adminId });
    if (result.error) throw result.error;
    const items = (result.data as Array<Record<string, unknown>>).map((item) => {
      const status = item.catalog_status;
      if (status !== "draft" && status !== "published" && status !== "archived") {
        throw new Error("Geçersiz oyun katalog durumu.");
      }
      const game = gameSchema.parse({
        ...(item.game as Record<string, unknown>),
        status,
      });
      return { game, status, updatedAt: item.updated_at };
    });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oyun kataloğu yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { adminId, serviceClient } = await authorizedGameClients(request);
    const body = (await request.json()) as { action?: unknown; game?: unknown };
    if (body.action !== "save" && body.action !== "publish") {
      throw new Error("Geçersiz oyun işlemi.");
    }
    const parsedGame = gameSchema.parse(body.game);
    const saved = await serviceClient.rpc("save_game_draft", {
      candidate_game: parsedGame,
      actor_id: adminId,
    });
    if (saved.error) throw saved.error;
    const savedGame = gameSchema.parse(saved.data);
    if (body.action === "save") {
      return NextResponse.json({ status: "draft", game: savedGame });
    }
    const published = await serviceClient.rpc("publish_game_draft", {
      target_game_id: savedGame.id,
      actor_id: adminId,
    });
    if (published.error) throw published.error;
    return NextResponse.json({
      status: "published",
      game: gameSchema.parse(published.data),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oyun kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { adminId, serviceClient } = await authorizedGameClients(request);
    const gameId = new URL(request.url).searchParams.get("gameId")?.trim();
    if (!gameId) throw new Error("Arşivlenecek oyun kimliği eksik.");
    const result = await serviceClient.rpc("archive_published_game", {
      target_game_id: gameId,
      actor_id: adminId,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ status: "archived", archivedVersions: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oyun arşivlenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
