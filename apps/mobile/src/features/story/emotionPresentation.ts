import type { Asset, EmotionId } from "@adaptive/content-schema";

const EMOTION_LABELS: Record<EmotionId, string> = {
  happy: "Mutlu",
  sad: "Üzgün",
  angry: "Kızgın",
  scared: "Korkmuş",
};

export interface EmotionPresentation {
  symbol: string;
  accessibilityLabel: string;
  backgroundColor: string;
  borderColor: string;
  borderRadius: number;
}

const EMOTION_VISUALS: Record<
  EmotionId,
  Pick<EmotionPresentation, "backgroundColor" | "borderColor" | "borderRadius">
> = {
  happy: { backgroundColor: "#FFF0A8", borderColor: "#F2B84B", borderRadius: 52 },
  sad: { backgroundColor: "#CFEAF6", borderColor: "#55A9D6", borderRadius: 34 },
  angry: { backgroundColor: "#FFD1CA", borderColor: "#E85D4A", borderRadius: 18 },
  scared: { backgroundColor: "#E4D7F5", borderColor: "#8D6AC8", borderRadius: 42 },
};

export function getEmotionPresentation(emotion: EmotionId, assets: Asset[]): EmotionPresentation {
  const asset = assets.find((candidate) => candidate.id === `emotion-${emotion}`);
  const symbol =
    asset?.type === "symbol" && asset.uri.startsWith("emoji:")
      ? asset.uri.slice("emoji:".length)
      : "●";
  const label = EMOTION_LABELS[emotion];

  return {
    symbol,
    accessibilityLabel: asset?.accessibilityLabel ?? `${label} yüz ifadesi`,
    ...EMOTION_VISUALS[emotion],
  };
}
