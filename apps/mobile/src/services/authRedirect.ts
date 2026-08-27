export function readAuthRedirectParameters(url: string): URLSearchParams {
  const parameters = new URLSearchParams();

  for (const separator of ["?", "#"] as const) {
    const start = url.indexOf(separator);
    if (start < 0) continue;

    const end = separator === "?" ? url.indexOf("#", start) : -1;
    const section = url.slice(start + 1, end < 0 ? undefined : end);
    for (const [key, value] of new URLSearchParams(section)) {
      parameters.set(key, value);
    }
  }

  return parameters;
}

export function isPasswordRecoveryUrl(url: string): boolean {
  const parameters = readAuthRedirectParameters(url);
  const path = url.split(/[?#]/, 1)[0];
  return path.includes("reset-password") || parameters.get("type") === "recovery";
}
