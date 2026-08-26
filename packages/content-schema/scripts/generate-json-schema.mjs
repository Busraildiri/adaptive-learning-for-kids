import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { contentVersionSchema } from "../.schema-build/schemas.js";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildDirectory = resolve(packageDirectory, ".schema-build");
const outputPath = resolve(packageDirectory, "generated/content-version.schema.json");

const jsonSchema = {
  $id: "https://adaptive-learning-for-kids.dev/schemas/content-version.schema.json",
  title: "Adaptive Learning Content Version",
  ...z.toJSONSchema(contentVersionSchema, { target: "draft-2020-12" }),
};

try {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(jsonSchema, null, 2)}\n`, "utf8");
} finally {
  await rm(buildDirectory, { recursive: true, force: true });
}
