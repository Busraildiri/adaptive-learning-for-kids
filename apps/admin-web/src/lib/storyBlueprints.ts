export interface StoryBlueprint {
  id: string;
  label: string;
  description: string;
  mechanicsSourceStoryId: string;
  defaultSceneAssetId: string;
}

export const storyBlueprints: StoryBlueprint[] = [
  {
    id: "lost-and-found",
    label: "Kaybolan bir şeyi birlikte bulma",
    description: "Bir eşya kaybolur, duygu fark edilir ve çocuk güvenli bir yardım yolu seçer.",
    mechanicsSourceStoryId: "mino-lost-toy-story",
    defaultSceneAssetId: "scene-lost-toy",
  },
  {
    id: "build-and-try-again",
    label: "Yıkılan veya bozulan bir şeyi yeniden deneme",
    description:
      "Beklenmedik bir aksilik olur, duygu fark edilir ve yeniden denemeye eşlik edilir.",
    mechanicsSourceStoryId: "mino-block-tower-story",
    defaultSceneAssetId: "scene-block-tower",
  },
  {
    id: "goodbye-and-reconnect",
    label: "Veda edip yeniden buluşmayı düşünme",
    description: "Kısa bir ayrılık yaşanır, birden fazla duygu kabul edilir ve sakinleşme sunulur.",
    mechanicsSourceStoryId: "mino-friend-goodbye-story",
    defaultSceneAssetId: "scene-friend-goodbye",
  },
  {
    id: "surprise-and-support",
    label: "Beklenmedik olaydan sonra destek seçme",
    description: "Şaşırtan bir olay olur, duygu fark edilir ve çocuk bir destek biçimi seçer.",
    mechanicsSourceStoryId: "mino-balloon-story",
    defaultSceneAssetId: "scene-birthday-balloons",
  },
];

export function findStoryBlueprint(id: string): StoryBlueprint | undefined {
  return storyBlueprints.find((blueprint) => blueprint.id === id);
}
