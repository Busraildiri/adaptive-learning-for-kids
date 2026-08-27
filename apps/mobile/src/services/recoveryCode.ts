export const RECOVERY_CODE_REQUIREMENTS_MESSAGE = "E-postadaki 6 haneli kodu yazın.";

export function normalizeRecoveryCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isValidRecoveryCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}
