import type { Asset, Story } from "@adaptive/content-schema";

export interface ManualGenerationInput {
  flowId: string;
  theme: string;
  targetEmotion: string;
  sceneAssetId: string;
  sendToReview: boolean;
}

export function isUsableGenerationAsset(asset: Asset): boolean {
  return (
    !asset.semantic ||
    (asset.semantic.reviewStatus === "approved" && asset.semantic.rightsStatus === "cleared")
  );
}

export function isAllowedSceneAsset(asset: Asset, template: Story): boolean {
  return (
    isUsableGenerationAsset(asset) &&
    (asset.type === "symbol" || asset.id === template.sceneAssetId)
  );
}

export function themeConflictsWithAsset(theme: string, asset: Asset): boolean {
  if (!asset.semantic) return false;
  const normalizedTheme = theme.toLocaleLowerCase("tr-TR");
  return asset.semantic.prohibitedNarrativeTerms.some((term) =>
    normalizedTheme.includes(term.toLocaleLowerCase("tr-TR")),
  );
}

export function parseManualGenerationInput(value: unknown): ManualGenerationInput {
  if (!value || typeof value !== "object") throw new Error("Geçersiz üretim isteği.");
  const input = value as Record<string, unknown>;
  const requiredString = (key: string, maxLength: number): string => {
    const field = input[key];
    if (typeof field !== "string" || !field.trim() || field.trim().length > maxLength) {
      throw new Error(`Geçersiz ${key} alanı.`);
    }
    return field.trim();
  };
  return {
    flowId: requiredString("flowId", 100),
    theme: requiredString("theme", 160),
    targetEmotion: requiredString("targetEmotion", 30),
    sceneAssetId: requiredString("sceneAssetId", 100),
    sendToReview: input.sendToReview === true,
  };
}

export function buildGenerationSkeleton(input: {
  template: Story;
  sceneAssetId: string;
  requestId: string;
}): Story {
  return {
    ...input.template,
    id: `${input.template.id}-v-${input.requestId.slice(0, 8)}`,
    version: 1,
    sceneAssetId: input.sceneAssetId,
  };
}
