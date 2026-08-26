export type AgeBand = "2-4" | "4-7";
export type Gender = "female" | "male" | "prefer_not_to_say";
export interface ChildSessionProfile {
  nickname: string;
  ageBand: AgeBand;
  favoriteAnimals: string[];
  favoriteToys: string[];
  interests: string[];
}
export type ConsentType =
  | "adaptive_learning"
  | "learning_insights"
  | "anonymous_product_improvement";
