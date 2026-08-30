import type { ChildProfile, ChildProfileInput } from "@adaptive/shared-types";
import type { Database } from "../lib/database.types";
import { requireSupabase } from "../lib/supabase";

export const GUARDIAN_DECLARATION_VERSION = "guardian-v1";
export const PRIVACY_NOTICE_VERSION = "privacy-v1";

export interface GuardianAcceptances {
  guardianAccepted: boolean;
  privacyAccepted: boolean;
}

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

export async function requestParentPasswordReset(
  email: string,
  redirectTo?: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = redirectTo
    ? await client.auth.resetPasswordForEmail(email, { redirectTo })
    : await client.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function requestCurrentParentPasswordReset(redirectTo?: string): Promise<string> {
  const client = requireSupabase();
  const { data, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!data.user.email) throw new Error("Hesaba bağlı bir e-posta adresi bulunamadı.");

  const email = data.user.email.trim().toLowerCase();
  const { error } = redirectTo
    ? await client.auth.resetPasswordForEmail(email, { redirectTo })
    : await client.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return email;
}

export async function verifyParentPasswordRecoveryOtp(email: string, token: string): Promise<void> {
  const { error } = await requireSupabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "recovery",
  });
  if (error) throw error;
}

export async function updateRecoveredParentPassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export async function changeParentPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const client = requireSupabase();
  const { data: currentUserData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!currentUserData.user.email) {
    throw new Error("Hesaba bağlı bir e-posta adresi bulunamadı.");
  }

  const { error: verificationError } = await client.auth.signInWithPassword({
    email: currentUserData.user.email,
    password: currentPassword,
  });
  if (verificationError) {
    throw new Error("Mevcut parola doğrulanamadı. Parolanızı kontrol edip tekrar deneyin.");
  }

  const { error } = await client.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });
  if (error) throw error;
}

export async function changeParentPin(currentPin: string, newPin: string): Promise<void> {
  const currentPinIsValid = await verifyParentPin(currentPin);
  if (!currentPinIsValid) {
    throw new Error("Mevcut ebeveyn PIN’i doğru değil.");
  }

  const { error } = await requireSupabase().rpc("set_parent_pin", { pin: newPin });
  if (error) throw error;
}

export async function updateParentAccountInfo({
  displayName,
  email,
  currentEmail,
}: {
  displayName: string;
  email: string;
  currentEmail: string;
}): Promise<{ emailConfirmationRequired: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCurrentEmail = currentEmail.trim().toLowerCase();
  const { error } = await requireSupabase().auth.updateUser({
    ...(normalizedEmail !== normalizedCurrentEmail ? { email: normalizedEmail } : {}),
    data: { display_name: displayName.trim() },
  });
  if (error) throw error;
  return { emailConfirmationRequired: normalizedEmail !== normalizedCurrentEmail };
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

export async function completeParentOnboarding(
  userId: string,
  pin: string,
  acceptances: GuardianAcceptances,
): Promise<void> {
  if (!acceptances.guardianAccepted || !acceptances.privacyAccepted) {
    throw new Error("İki zorunlu ebeveyn onayı da verilmelidir.");
  }

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

export async function updateChildProfile(
  childId: string,
  input: Pick<ChildProfileInput, "nickname" | "birthMonth" | "birthYear">,
): Promise<ChildProfile> {
  const { data, error } = await requireSupabase()
    .from("child_profiles")
    .update({
      nickname: input.nickname.trim(),
      birth_month: input.birthMonth,
      birth_year: input.birthYear,
    })
    .eq("id", childId)
    .select("*")
    .single();

  if (error) throw error;
  return mapChildProfile(data);
}

export async function deleteChildProfile(childId: string): Promise<void> {
  const { error } = await requireSupabase().from("child_profiles").delete().eq("id", childId);
  if (error) throw error;
}
