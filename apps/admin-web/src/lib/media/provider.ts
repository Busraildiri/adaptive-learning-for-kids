import type { MediaGenerationInput, MediaGenerationResult } from "./types";

export interface MediaProvider {
  readonly id: string;
  generate(input: MediaGenerationInput): Promise<MediaGenerationResult>;
}

const providers = new Map<string, MediaProvider>();

export function registerMediaProvider(provider: MediaProvider): void {
  providers.set(provider.id, provider);
}

export function getMediaProvider(id: string): MediaProvider {
  const provider = providers.get(id);
  if (!provider) throw new Error(`Bilinmeyen media provider: ${id}`);
  return provider;
}

export function listMediaProviderIds(): string[] {
  return [...providers.keys()];
}
