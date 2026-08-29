export type ChoiceVisualIcon =
  | "account-heart-outline"
  | "balloon"
  | "emoticon-angry-outline"
  | "emoticon-frown-outline"
  | "emoticon-happy-outline"
  | "emoticon-neutral-outline"
  | "emoticon-sad-outline"
  | "gesture-tap"
  | "gift-outline"
  | "hand-heart-outline"
  | "head-heart-outline";

export type ChoiceVisual = {
  backgroundColor: string;
  borderColor: string;
  icon: ChoiceVisualIcon;
  iconColor: string;
};

const visuals = {
  angry: {
    backgroundColor: "#FFD1CA",
    borderColor: "#E85D4A",
    icon: "emoticon-angry-outline",
    iconColor: "#A93628",
  },
  balloon: {
    backgroundColor: "#CDEBE4",
    borderColor: "#2D8C7C",
    icon: "balloon",
    iconColor: "#216D61",
  },
  fallback: {
    backgroundColor: "#EAF5F2",
    borderColor: "#5BAA9D",
    icon: "hand-heart-outline",
    iconColor: "#216D61",
  },
  gift: {
    backgroundColor: "#E7DDFC",
    borderColor: "#8D6AC8",
    icon: "gift-outline",
    iconColor: "#5E438D",
  },
  happy: {
    backgroundColor: "#FFF0A8",
    borderColor: "#F2B84B",
    icon: "emoticon-happy-outline",
    iconColor: "#9C6500",
  },
  hug: {
    backgroundColor: "#FFD9C8",
    borderColor: "#E99070",
    icon: "account-heart-outline",
    iconColor: "#B34831",
  },
  love: {
    backgroundColor: "#F9D3E3",
    borderColor: "#D86B9C",
    icon: "head-heart-outline",
    iconColor: "#9A3564",
  },
  neutral: {
    backgroundColor: "#E8E4DC",
    borderColor: "#A69B8C",
    icon: "emoticon-neutral-outline",
    iconColor: "#665B50",
  },
  pet: {
    backgroundColor: "#FFF0A8",
    borderColor: "#F2B84B",
    icon: "gesture-tap",
    iconColor: "#9C6500",
  },
  sad: {
    backgroundColor: "#CFEAF6",
    borderColor: "#55A9D6",
    icon: "emoticon-sad-outline",
    iconColor: "#286A8E",
  },
  scared: {
    backgroundColor: "#E4D7F5",
    borderColor: "#8D6AC8",
    icon: "emoticon-frown-outline",
    iconColor: "#5E438D",
  },
} satisfies Record<string, ChoiceVisual>;

function containsAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

/**
 * Published AI choices have stable semantic ids (for example emotion-sad and
 * help-give_gift). Labels are included as a compatibility fallback for older
 * publications, so visual choices also work without republishing a story.
 */
export function getChoiceVisual(optionId: string, label: string): ChoiceVisual {
  const value = `${optionId} ${label}`.toLocaleLowerCase("tr-TR").replaceAll(/[_-]/g, " ");

  if (containsAny(value, ["happy", "mutlu", "neşeli"])) return visuals.happy;
  if (containsAny(value, ["sad", "üzgün", "üzüntü"])) return visuals.sad;
  if (containsAny(value, ["angry", "kızgın", "öfkeli"])) return visuals.angry;
  if (containsAny(value, ["scared", "afraid", "korkmuş", "korku"])) return visuals.scared;
  if (containsAny(value, ["neutral", "sakin", "normal"])) return visuals.neutral;
  if (containsAny(value, ["new balloon", "balon"])) return visuals.balloon;
  if (containsAny(value, ["give gift", "hediye"])) return visuals.gift;
  if (containsAny(value, ["say love", "sevdiğini", "seviyorum", "sevgi"])) return visuals.love;
  if (containsAny(value, ["pet head", "başını okşa", "başını okşay", "okşa"])) {
    return visuals.pet;
  }
  if (containsAny(value, ["hug", "sarıl"])) return visuals.hug;

  return visuals.fallback;
}
