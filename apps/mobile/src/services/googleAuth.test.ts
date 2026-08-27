import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completeAuthRedirect: vi.fn(),
  createURL: vi.fn(),
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("expo-linking", () => ({ createURL: mocks.createURL }));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: mocks.maybeCompleteAuthSession,
  openAuthSessionAsync: mocks.openAuthSessionAsync,
}));
vi.mock("../lib/supabase", () => ({
  requireSupabase: () => ({ auth: { signInWithOAuth: mocks.signInWithOAuth } }),
}));
vi.mock("./authDeepLink", () => ({ completeAuthRedirect: mocks.completeAuthRedirect }));

import { signInParentWithGoogle } from "./googleAuth";

describe("Google ebeveyn girişi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createURL.mockReturnValue("adaptivekids://auth/callback");
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.supabase.co/oauth/google" },
      error: null,
    });
    mocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "adaptivekids://auth/callback#access_token=access&refresh_token=refresh",
    });
    mocks.completeAuthRedirect.mockResolvedValue(undefined);
  });

  it("Expo Go yönlendirmesini başlamadan reddeder", async () => {
    mocks.createURL.mockReturnValue("exp://127.0.0.1:8081/--/auth/callback");

    await expect(signInParentWithGoogle()).rejects.toThrow("Development build");
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("Google OAuth dönüşünü Supabase oturumuna çevirir", async () => {
    await expect(signInParentWithGoogle()).resolves.toBe(true);

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "adaptivekids://auth/callback",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    expect(mocks.completeAuthRedirect).toHaveBeenCalledWith(
      "adaptivekids://auth/callback#access_token=access&refresh_token=refresh",
    );
  });

  it("kullanıcı tarayıcıyı kapatırsa oturum oluşturmaz", async () => {
    mocks.openAuthSessionAsync.mockResolvedValue({ type: "cancel" });

    await expect(signInParentWithGoogle()).resolves.toBe(false);
    expect(mocks.completeAuthRedirect).not.toHaveBeenCalled();
  });
});
