import { randomUUID } from "node:crypto";
import {
  ageBandSchema,
  contentVersionSchema,
  type Game,
  gameDifficultyLevelSchema,
  gameMechanicSchema,
  gameSchema,
} from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createApprovedGameDraft, createBktGameDraftSet } from "../../../lib/gameAutomation";
import { parseGameCatalogRows } from "../../../lib/gameCatalog";

export const runtime = "nodejs";
const bundledGames = contentVersionSchema.parse(contentJson).games ?? [];

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
    const [result, tombstoneResult] = await Promise.all([
      serviceClient.rpc("list_game_catalog", { actor_id: adminId }),
      serviceClient.from("game_catalog_tombstones").select("game_id"),
    ]);
    if (result.error) throw result.error;
    const catalog = parseGameCatalogRows(result.data as Array<Record<string, unknown>>);
    const deletedGameIds = tombstoneResult.error
      ? []
      : (tombstoneResult.data ?? []).map((row) => row.game_id);
    return NextResponse.json({ ...catalog, deletedGameIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oyun kataloğu yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { adminId, serviceClient } = await authorizedGameClients(request);
    const body = (await request.json()) as {
      action?: unknown;
      game?: unknown;
      ageBand?: unknown;
      mechanic?: unknown;
      difficulty?: unknown;
      templateId?: unknown;
    };
    if (body.action === "generate_bkt_set") {
      const ageBand = ageBandSchema.parse(body.ageBand);
      const drafts = createBktGameDraftSet(bundledGames, {
        ageBand,
        ids: {
          starter: `auto-bkt-starter-${randomUUID()}`,
          growing: `auto-bkt-growing-${randomUUID()}`,
          advanced: `auto-bkt-advanced-${randomUUID()}`,
        },
      });
      const savedGames: Game[] = [];
      for (const draft of drafts) {
        const saved = await serviceClient.rpc("save_game_draft", {
          candidate_game: draft,
          actor_id: adminId,
        });
        if (saved.error) throw saved.error;
        savedGames.push(gameSchema.parse(saved.data));
      }
      return NextResponse.json({ status: "draft", games: savedGames });
    }
    if (body.action === "generate") {
      const draft = createApprovedGameDraft(bundledGames, {
        id: `auto-${randomUUID()}`,
        ageBand: ageBandSchema.parse(body.ageBand),
        mechanic: gameMechanicSchema.parse(body.mechanic),
        difficulty: gameDifficultyLevelSchema.parse(body.difficulty),
        templateId:
          typeof body.templateId === "string" && body.templateId.trim()
            ? body.templateId.trim()
            : undefined,
      });
      const saved = await serviceClient.rpc("save_game_draft", {
        candidate_game: draft,
        actor_id: adminId,
      });
      if (saved.error) throw saved.error;
      return NextResponse.json({
        status: "draft",
        game: gameSchema.parse(saved.data),
      });
    }
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
    const searchParams = new URL(request.url).searchParams;
    const gameId = searchParams.get("gameId")?.trim();
    if (!gameId) throw new Error("Oyun kimliği eksik.");
    if (searchParams.get("catalogStatus") === "draft") {
      const result = await serviceClient.rpc("delete_game_draft", {
        target_game_id: gameId,
        actor_id: adminId,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ status: "deleted", deletedDrafts: result.data });
    }
    const catalogStatus = searchParams.get("catalogStatus");
    if (catalogStatus === "published" || catalogStatus === "archived") {
      const result = await serviceClient.rpc("delete_game_catalog_entry", {
        target_game_id: gameId,
        target_catalog_status: catalogStatus,
        actor_id: adminId,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ status: "deleted", deletedVersions: result.data });
    }
    const result = await serviceClient.rpc("archive_published_game", {
      target_game_id: gameId,
      actor_id: adminId,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ status: "archived", archivedVersions: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oyun işlemi tamamlanamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
