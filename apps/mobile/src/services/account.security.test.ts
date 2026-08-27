import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  requireSupabase: () => ({ auth: authMocks }),
}));

import { changeParentPassword, completeParentOnboarding } from "./account";

describe("ebeveyn hesabı güvenliği", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getUser.mockResolvedValue({
      data: { user: { email: "parent@example.com" } },
      error: null,
    });
    authMocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    authMocks.updateUser.mockResolvedValue({ data: {}, error: null });
  });

  it("parolayı güncellemeden önce mevcut parolayla yeniden kimlik doğrular", async () => {
    await changeParentPassword("OldPass1", "NewPass2");

    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "parent@example.com",
      password: "OldPass1",
    });
    expect(authMocks.updateUser).toHaveBeenCalledWith({
      password: "NewPass2",
      current_password: "OldPass1",
    });
    expect(authMocks.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
      authMocks.updateUser.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("mevcut parola yanlışsa yeni parolayı kaydetmez", async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error("Invalid login credentials"),
    });

    await expect(changeParentPassword("WrongPass1", "NewPass2")).rejects.toThrow(
      "Mevcut parola doğrulanamadı",
    );
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("iki zorunlu ebeveyn onayı olmadan onboarding başlatmaz", async () => {
    await expect(
      completeParentOnboarding("parent-id", "1234", {
        guardianAccepted: true,
        privacyAccepted: false,
      }),
    ).rejects.toThrow("İki zorunlu ebeveyn onayı");
    expect(authMocks.getUser).not.toHaveBeenCalled();
  });
});
