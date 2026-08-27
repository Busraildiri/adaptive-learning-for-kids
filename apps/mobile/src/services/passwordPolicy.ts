export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Parola en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.";

export function isValidParentPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
