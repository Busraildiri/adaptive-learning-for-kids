import type { ChildProfile, ChildProfileInput } from "@adaptive/shared-types";
import type { Database } from "../lib/database.types";
import { requireSupabase } from "../lib/supabase";

export const GUARDIAN_DECLARATION_VERSION = "guardian-v1";
export const PRIVACY_NOTICE_VERSION = "privacy-v1";

type ParentProfileRow = Database["public"]["Tables"]["parent_profiles"]["Row"];
type ChildProfileRow = Database["public"]["Tables"]["child_profiles"]["Row"];

function mapChildProfile(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    parentId: row.parent_id,
    nickname: row.nickname,
    birthMonth: row.birth_month,
    birthYear: row.birth_year,
    contentLocale: row.content_locale,
    favoriteAnimals: row.favorite_animals,
    favoriteToys: row.favorite_toys,
    interests: row.interests,
  };
}

export async function signUpParent(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInParent(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutParent(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function loadParentProfile(userId: string): Promise<ParentProfileRow | null> {
  const { data, error } = await requireSupabase()
    .from("parent_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function completeParentOnboarding(userId: string, pin: string): Promise<void> {
  const client = requireSupabase();
  const existingProfile = await loadParentProfile(userId);

  if (!existingProfile) {
    const { error: profileError } = await client.from("parent_profiles").insert({
      id: userId,
      guardian_confirmed_at: new Date().toISOString(),
      guardian_declaration_version: GUARDIAN_DECLARATION_VERSION,
      privacy_notice_version: PRIVACY_NOTICE_VERSION,
    });

    if (profileError) throw profileError;
  }

  const { error: pinError } = await client.rpc("set_parent_pin", { pin });
  if (pinError) throw pinError;
}

export async function verifyParentPin(pin: string): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc("verify_parent_pin", { pin });
  if (error) throw error;
  return data;
}

export async function loadChildProfiles(): Promise<ChildProfile[]> {
  const { data, error } = await requireSupabase()
    .from("child_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data.map(mapChildProfile);
}

export async function createChildProfile(
  parentId: string,
  input: ChildProfileInput,
): Promise<ChildProfile> {
  const { data, error } = await requireSupabase()
    .from("child_profiles")
    .insert({
      parent_id: parentId,
      nickname: input.nickname.trim(),
      birth_month: input.birthMonth,
      birth_year: input.birthYear,
      content_locale: input.contentLocale,
      favorite_animals: input.favoriteAnimals,
      favorite_toys: input.favoriteToys,
      interests: input.interests,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapChildProfile(data);
}
