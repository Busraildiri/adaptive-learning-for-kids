import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "./database.types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECURE_STORE_CHUNK_SIZE = 1_800;

interface ChunkMetadata {
  chunks: number;
}

const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const metadataValue = await SecureStore.getItemAsync(`${key}.metadata`);

    if (!metadataValue) return null;

    const metadata = JSON.parse(metadataValue) as ChunkMetadata;
    const chunks = await Promise.all(
      Array.from({ length: metadata.chunks }, (_, index) =>
        SecureStore.getItemAsync(`${key}.chunk.${index}`),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const oldMetadataValue = await SecureStore.getItemAsync(`${key}.metadata`);
    const oldChunkCount = oldMetadataValue
      ? (JSON.parse(oldMetadataValue) as ChunkMetadata).chunks
      : 0;
    const chunks = Array.from(
      { length: Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE) },
      (_, index) =>
        value.slice(index * SECURE_STORE_CHUNK_SIZE, (index + 1) * SECURE_STORE_CHUNK_SIZE),
    );

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}.chunk.${index}`, chunk, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      ),
    );
    await SecureStore.setItemAsync(
      `${key}.metadata`,
      JSON.stringify({ chunks: chunks.length } satisfies ChunkMetadata),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );

    await Promise.all(
      Array.from({ length: Math.max(0, oldChunkCount - chunks.length) }, (_, offset) =>
        SecureStore.deleteItemAsync(`${key}.chunk.${chunks.length + offset}`),
      ),
    );
  },

  async removeItem(key: string): Promise<void> {
    const metadataValue = await SecureStore.getItemAsync(`${key}.metadata`);
    const chunkCount = metadataValue ? (JSON.parse(metadataValue) as ChunkMetadata).chunks : 0;

    await Promise.all([
      SecureStore.deleteItemAsync(`${key}.metadata`),
      ...Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.chunk.${index}`),
      ),
    ]);
  },
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabasePublishableKey as string, {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return supabase;
}
