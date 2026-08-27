import { describe, expect, it } from "vitest";
import { isPasswordRecoveryUrl, readAuthRedirectParameters } from "./authRedirect";
import { isValidParentPassword } from "./passwordPolicy";

describe("password recovery redirects", () => {
  it("recognizes the custom application scheme", () => {
    expect(
      isPasswordRecoveryUrl(
        "adaptivekids://reset-password#access_token=access&refresh_token=refresh&type=recovery",
      ),
    ).toBe(true);
  });

  it("recognizes an Expo Go recovery URL", () => {
    expect(
      isPasswordRecoveryUrl(
        "exp://192.168.1.20:8081/--/reset-password?code=pkce-code&type=recovery",
      ),
    ).toBe(true);
  });

  it("ignores ordinary application links", () => {
    expect(isPasswordRecoveryUrl("adaptivekids://parent-home")).toBe(false);
  });

  it("reads query and fragment parameters without losing either section", () => {
    const parameters = readAuthRedirectParameters(
      "adaptivekids://reset-password?code=pkce-code#type=recovery&error_description=Expired+link",
    );

    expect(parameters.get("code")).toBe("pkce-code");
    expect(parameters.get("type")).toBe("recovery");
    expect(parameters.get("error_description")).toBe("Expired link");
  });
});

describe("parent password policy", () => {
  it("requires length, uppercase, lowercase and a number", () => {
    expect(isValidParentPassword("Guvenli8")).toBe(true);
    expect(isValidParentPassword("guvenli8")).toBe(false);
    expect(isValidParentPassword("GUVENLI8")).toBe(false);
    expect(isValidParentPassword("GuvenliX")).toBe(false);
    expect(isValidParentPassword("Kisa1a")).toBe(false);
  });
});
