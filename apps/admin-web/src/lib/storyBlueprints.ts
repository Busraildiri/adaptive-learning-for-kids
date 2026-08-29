import type { ExperienceType } from "@adaptive/content-schema";

export interface StoryBlueprint {
  id: string;
  label: string;
  description: string;
  mechanicsSourceStoryId: string;
  defaultSceneAssetId: string;
  // Must always equal the referenced template Story's own experienceType
  // (packages/content-schema) -- verified by a deterministic test
  // (storyBlueprints.test.ts) rather than trusted by convention, so this
  // metadata and the template it points at can never silently drift apart.
  experienceType: ExperienceType;
}

export const storyBlueprints: StoryBlueprint[] = [
  {
    id: "lost-and-found",
    label: "Kaybolan bir şeyi birlikte bulma",
    description: "Bir eşya kaybolur, duygu fark edilir ve çocuk güvenli bir yardım yolu seçer.",
    mechanicsSourceStoryId: "mino-lost-toy-story",
    defaultSceneAssetId: "scene-lost-toy",
    experienceType: "interactive_ui",
  },
  {
    id: "build-and-try-again",
    label: "Yıkılan veya bozulan bir şeyi yeniden deneme",
    description:
      "Beklenmedik bir aksilik olur, duygu fark edilir ve yeniden denemeye eşlik edilir.",
    mechanicsSourceStoryId: "mino-block-tower-story",
    defaultSceneAssetId: "scene-block-tower",
    experienceType: "interactive_ui",
  },
  {
    id: "goodbye-and-reconnect",
    label: "Veda edip yeniden buluşmayı düşünme",
    description: "Kısa bir ayrılık yaşanır, birden fazla duygu kabul edilir ve sakinleşme sunulur.",
    mechanicsSourceStoryId: "mino-friend-goodbye-story",
    defaultSceneAssetId: "scene-friend-goodbye",
    experienceType: "interactive_ui",
  },
  {
    id: "surprise-and-support",
    label: "Beklenmedik olaydan sonra destek seçme",
    description: "Şaşırtan bir olay olur, duygu fark edilir ve çocuk bir destek biçimi seçer.",
    mechanicsSourceStoryId: "mino-balloon-story",
    defaultSceneAssetId: "scene-birthday-balloons",
    experienceType: "interactive_ui",
  },
  {
    id: "share-and-take-turns",
    label: "Sırasını bekleyip paylaşmayı öğrenme",
    description:
      "İhtiyaç duyduğu şey başkasındayken çocuk, Mino'nun beklerken sakinleşmesine tek bir " +
      "şekilde eşlik eder.",
    mechanicsSourceStoryId: "video-branching-crayons-story",
    defaultSceneAssetId: "scene-shared-crayons",
    experienceType: "video_branching",
  },
];

export function findStoryBlueprint(id: string): StoryBlueprint | undefined {
  return storyBlueprints.find((blueprint) => blueprint.id === id);
}

/** Data-driven filtering, not a hardcoded blueprint-id list -- the Content
 * Production Studio uses this so a new video_branching blueprint only ever
 * needs an entry here, never a React-side ID check. */
export function videoBranchingBlueprints(): StoryBlueprint[] {
  return storyBlueprints.filter((blueprint) => blueprint.experienceType === "video_branching");
}
