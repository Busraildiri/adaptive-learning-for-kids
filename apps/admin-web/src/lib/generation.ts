import type { AgeBand, Asset, Story } from "@adaptive/content-schema";

export const AGE_BANDS: AgeBand[] = ["2-4", "4-7"];

export interface ManualGenerationInput {
  flowId: string;
  theme: string;
  targetEmotion: string;
  sceneAssetId: string;
  flowAssetIds: string[];
  ageBands: AgeBand[];
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

export function isUsableFlowAsset(asset: Asset): boolean {
  return isUsableGenerationAsset(asset) && (asset.type === "image" || asset.type === "video");
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
  const flowId = requiredString("flowId", 100);
  const theme = requiredString("theme", 160);
  const targetEmotion = requiredString("targetEmotion", 30);
  const sceneAssetId = requiredString("sceneAssetId", 100);
  const rawFlowAssetIds = input.flowAssetIds;
  if (!Array.isArray(rawFlowAssetIds) || rawFlowAssetIds.length === 0) {
    throw new Error("En az bir içerik (görsel veya video) seçilmeli.");
  }
  const flowAssetIds = rawFlowAssetIds.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  if (flowAssetIds.length === 0 || flowAssetIds.length > 4) {
    throw new Error("İçerik listesi 1 ile 4 öğe arasında olmalı.");
  }
  const rawAgeBands = input.ageBands;
  if (!Array.isArray(rawAgeBands) || rawAgeBands.length === 0) {
    throw new Error("En az bir yaş aralığı seçilmeli.");
  }
  const ageBands = rawAgeBands.filter((item): item is AgeBand =>
    AGE_BANDS.includes(item as AgeBand),
  );
  if (ageBands.length === 0) throw new Error("Geçersiz yaş aralığı seçimi.");
  return {
    flowId,
    theme,
    targetEmotion,
    sceneAssetId,
    flowAssetIds,
    ageBands,
    sendToReview: input.sendToReview === true,
  };
}

export function buildGenerationSkeleton(input: {
  template: Story;
  sceneAssetId: string;
  flowAssetIds: string[];
  ageBands: AgeBand[];
  requestId: string;
}): Story {
  const [firstAssetId, secondAssetId] = input.flowAssetIds;
  const [firstAgeBand, ...restAgeBands] = input.ageBands;
  return {
    ...input.template,
    id: `${input.template.id}-v-${input.requestId.slice(0, 8)}`,
    version: 1,
    sceneAssetId: input.sceneAssetId,
    flowAssetIds: input.flowAssetIds,
    ageBands: [firstAgeBand, ...restAgeBands],
    characterAssets: {
      happyAssetId: firstAssetId,
      sadAssetId: secondAssetId ?? firstAssetId,
    },
  };
}
