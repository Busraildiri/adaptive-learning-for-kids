import { readFile } from "node:fs/promises";

const APPLY_FLAG = "--apply";
const duplicateBobiMemoryIds = [
  "auto-0bdac6f0-b0c5-4333-ba2e-54f08b060ed2",
  "auto-220aed38-1678-41d2-82d1-1d7e4397d3d6",
  "auto-42e5199b-9674-47c5-b90a-f8c1cd66f151",
  "auto-9bb1e90f-f38c-49b1-858a-142ff1d2d220",
  "auto-a5dbdc76-e26d-4d48-94f4-8eabc8cd0c53",
  "auto-d144211e-cae5-4189-baa1-e7beff6c38ae",
  "auto-dd91607a-36ec-456c-99f6-0f87e938c655",
  "auto-e13636fc-cc68-41da-80b2-be934bd5141a",
];

function parseEnvironment(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator),
          line
            .slice(separator + 1)
            .trim()
            .replace(/^"|"$/g, ""),
        ];
      }),
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "version" && key !== "status")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

function sameGameContent(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

async function request(url, serviceRoleKey, path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const [environmentSource, contentSource] = await Promise.all([
    readFile(new URL("../apps/admin-web/.env.local", import.meta.url), "utf8"),
    readFile(
      new URL("../packages/content-schema/content/tr-TR/content.v1.json", import.meta.url),
      "utf8",
    ),
  ]);
  const environment = parseEnvironment(environmentSource);
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase service credentials are missing.");

  const bundledGames = JSON.parse(contentSource).games ?? [];
  const [publishedRows, tombstoneRows] = await Promise.all([
    request(
      url,
      serviceRoleKey,
      "published_game_versions?select=game_id,game_version,age_band,game,published_by&order=game_id.asc,game_version.asc",
    ),
    request(url, serviceRoleKey, "game_catalog_tombstones?select=game_id"),
  ]);
  const adminId = publishedRows.find((row) => row.published_by)?.published_by;
  if (!adminId) throw new Error("A publishing administrator could not be resolved.");
  const deletedGameIds = new Set(tombstoneRows.map((row) => row.game_id));
  const activeBundledGames = bundledGames.filter((game) => !deletedGameIds.has(game.id));

  const rowsById = new Map();
  for (const row of publishedRows) {
    const rows = rowsById.get(row.game_id) ?? [];
    rows.push(row);
    rowsById.set(row.game_id, rows);
  }

  const inserts = [];
  for (const game of activeBundledGames) {
    const existing = rowsById.get(game.id) ?? [];
    const current = existing.some(
      (row) => row.game_version >= game.version && sameGameContent(row.game, game),
    );
    if (current) continue;
    const remoteMaximum = Math.max(0, ...existing.map((row) => row.game_version));
    const version = Math.max(game.version, remoteMaximum + 1);
    inserts.push({
      game_id: game.id,
      game_version: version,
      age_band: game.ageBand,
      game: { ...game, version, status: "published" },
      published_by: adminId,
    });
  }

  const tomoLegacyRows = publishedRows.filter(
    (row) => row.game_id === "mino-routine-path-001" && row.age_band !== "2-4",
  );
  const bobiDuplicates = publishedRows.filter((row) =>
    duplicateBobiMemoryIds.includes(row.game_id),
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        bundledGameCount: bundledGames.length,
        skippedDeletedGameCount: deletedGameIds.size,
        inserts: inserts.map((row) => ({
          id: row.game_id,
          version: row.game_version,
          ageBand: row.age_band,
          title: row.game.title,
        })),
        deleteTomo: tomoLegacyRows.map((row) => ({
          id: row.game_id,
          version: row.game_version,
          ageBand: row.age_band,
        })),
        deleteBobiMemoryDuplicates: bobiDuplicates.map((row) => row.game_id),
      },
      null,
      2,
    ),
  );
  if (!apply) return;

  if (inserts.length > 0) {
    await request(url, serviceRoleKey, "published_game_versions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(inserts),
    });
  }

  const rowsAfterInsert = await request(
    url,
    serviceRoleKey,
    "published_game_versions?select=game_id,game_version,age_band,game&order=game_id.asc,game_version.desc",
  );
  for (const game of activeBundledGames) {
    const latest = rowsAfterInsert.find((row) => row.game_id === game.id);
    if (
      !latest ||
      latest.age_band !== game.ageBand ||
      latest.game_version < game.version ||
      !sameGameContent(latest.game, game)
    ) {
      throw new Error(`Canonical verification failed before cleanup: ${game.id}`);
    }
  }

  for (const row of tomoLegacyRows) {
    await request(
      url,
      serviceRoleKey,
      `published_game_versions?game_id=eq.${encodeURIComponent(row.game_id)}&game_version=eq.${row.game_version}`,
      { method: "DELETE", headers: { Prefer: "return=representation" } },
    );
  }
  for (const row of bobiDuplicates) {
    await request(
      url,
      serviceRoleKey,
      `published_game_versions?game_id=eq.${encodeURIComponent(row.game_id)}`,
      { method: "DELETE", headers: { Prefer: "return=representation" } },
    );
  }

  const finalRows = await request(
    url,
    serviceRoleKey,
    "published_game_versions?select=game_id,game_version,age_band,game&order=game_id.asc,game_version.desc",
  );
  const canonicalIds = new Set(activeBundledGames.map((game) => game.id));
  const finalCanonicalIds = new Set(
    finalRows.filter((row) => canonicalIds.has(row.game_id)).map((row) => row.game_id),
  );
  const remainingBobiDuplicates = finalRows.filter((row) =>
    duplicateBobiMemoryIds.includes(row.game_id),
  );
  const remainingInvalidTomo = finalRows.filter(
    (row) => row.game_id === "mino-routine-path-001" && row.age_band !== "2-4",
  );
  if (
    finalCanonicalIds.size !== activeBundledGames.length ||
    remainingBobiDuplicates.length > 0 ||
    remainingInvalidTomo.length > 0
  ) {
    throw new Error("Final catalog verification failed.");
  }

  console.log(
    JSON.stringify(
      {
        result: "ok",
        canonicalGames: finalCanonicalIds.size,
        insertedVersions: inserts.length,
        deletedBobiMemoryDuplicates: bobiDuplicates.length,
        deletedInvalidTomoVersions: tomoLegacyRows.length,
      },
      null,
      2,
    ),
  );
}

await main();
