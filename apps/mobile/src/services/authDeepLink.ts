import { requireSupabase } from "../lib/supabase";
import { isPasswordRecoveryUrl, readAuthRedirectParameters } from "./authRedirect";

export { isPasswordRecoveryUrl } from "./authRedirect";

export async function completeAuthRedirect(url: string): Promise<void> {
  const parameters = readAuthRedirectParameters(url);
  const authError = parameters.get("error_description") ?? parameters.get("error");
  if (authError) throw new Error(authError.replaceAll("+", " "));

  const code = parameters.get("code");
  if (code) {
    const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = parameters.get("access_token");
  const refreshToken = parameters.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("Parola yenileme bağlantısı eksik veya süresi dolmuş.");
  }

  const { error } = await requireSupabase().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}

export async function completePasswordRecoveryRedirect(url: string): Promise<boolean> {
  if (!isPasswordRecoveryUrl(url)) return false;

  await completeAuthRedirect(url);
  return true;
}
