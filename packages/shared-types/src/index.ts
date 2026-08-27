export type AgeBand = "2-4" | "4-7";
export type ContentLocale = "tr-TR";

export interface ChildProfile {
  id: string;
  parentId: string;
  nickname: string;
  birthMonth: number;
  birthYear: number;
  contentLocale: ContentLocale;
  favoriteAnimals: string[];
  favoriteToys: string[];
  interests: string[];
}

export type ChildProfileInput = Omit<ChildProfile, "id" | "parentId">;

export interface ChildSessionProfile {
  id: string;
  nickname: string;
  ageBand: AgeBand;
  contentLocale: ContentLocale;
  favoriteAnimals: string[];
  favoriteToys: string[];
  interests: string[];
}

export function calculateAgeInMonths(
  birthMonth: number,
  birthYear: number,
  today = new Date(),
): number {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
    throw new RangeError("birthMonth must be an integer between 1 and 12.");
  }

  if (!Number.isInteger(birthYear) || birthYear < 1) {
    throw new RangeError("birthYear must be a positive integer.");
  }

  return today.getFullYear() * 12 + today.getMonth() - (birthYear * 12 + birthMonth - 1);
}

export function resolveAgeBand(
  birthMonth: number,
  birthYear: number,
  today = new Date(),
): AgeBand | null {
  const ageInMonths = calculateAgeInMonths(birthMonth, birthYear, today);

  if (ageInMonths >= 24 && ageInMonths <= 47) return "2-4";
  if (ageInMonths >= 48 && ageInMonths <= 83) return "4-7";
  return null;
}

export function createChildSessionProfile(
  profile: ChildProfile,
  today = new Date(),
): ChildSessionProfile {
  const ageBand = resolveAgeBand(profile.birthMonth, profile.birthYear, today);

  if (!ageBand) {
    throw new RangeError("Child profile is outside the supported 24-83 month range.");
  }

  return {
    id: profile.id,
    nickname: profile.nickname,
    ageBand,
    contentLocale: profile.contentLocale,
    favoriteAnimals: profile.favoriteAnimals,
    favoriteToys: profile.favoriteToys,
    interests: profile.interests,
  };
}

export type ConsentType =
  | "adaptive_learning"
  | "learning_insights"
  | "anonymous_product_improvement";
