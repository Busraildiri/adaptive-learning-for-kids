import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { requireSupabase } from "../lib/supabase";
import { completeAuthRedirect } from "./authDeepLink";

WebBrowser.maybeCompleteAuthSession();

export async function signInParentWithGoogle(): Promise<boolean> {
  const redirectTo = Linking.createURL("auth/callback");

  if (redirectTo.startsWith("exp://") || redirectTo.startsWith("exps://")) {
    throw new Error(
      "Google ile giriş Expo Go'da güvenilir biçimde test edilemez. Development build kullanın.",
    );
  }

  const { data, error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google giriş adresi oluşturulamadı.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;

  await completeAuthRedirect(result.url);
  return true;
}
