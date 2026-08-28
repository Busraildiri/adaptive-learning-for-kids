import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} sunucu ortam değişkeni eksik.`);
  return value;
}

export interface ContentAdminSession {
  userId: string;
  /** Scoped to the caller's own Bearer token, so RPCs see the right auth.uid(). */
  client: SupabaseClient;
}

export async function requireContentAdminSession(
  request: Request,
  supabaseUrl: string,
  publishableKey: string,
): Promise<ContentAdminSession> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Yönetici oturumu gerekli.");
  const token = authorization.slice("Bearer ".length);
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: userData, error: userError }, adminResult] = await Promise.all([
    client.auth.getUser(token),
    client.rpc("is_content_admin"),
  ]);
  if (userError || !userData.user || adminResult.error || !adminResult.data) {
    throw new Error("İçerik yöneticisi yetkisi gerekli.");
  }
  return { userId: userData.user.id, client };
}

export async function requireContentAdmin(
  request: Request,
  supabaseUrl: string,
  publishableKey: string,
): Promise<string> {
  return (await requireContentAdminSession(request, supabaseUrl, publishableKey)).userId;
}
