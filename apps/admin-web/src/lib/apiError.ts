export interface ApiErrorDescription {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
  httpStatus?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clippedText(value: unknown, maxLength = 2_000): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.slice(0, maxLength);
}

function numericStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d{3}$/u.test(value)) return Number(value);
  return undefined;
}

export function describeUnknownError(error: unknown, fallback: string): ApiErrorDescription {
  if (typeof error === "string") return { message: clippedText(error) ?? fallback };

  const record = isRecord(error) ? error : null;
  const nested = record && isRecord(record.error) ? record.error : null;
  const errorInstance = error instanceof Error ? error : null;
  const message =
    clippedText(errorInstance?.message) ??
    clippedText(record?.message) ??
    clippedText(nested?.message) ??
    fallback;
  const details =
    clippedText(record?.details) ??
    clippedText(record?.detail) ??
    clippedText(nested?.details) ??
    clippedText(nested?.detail) ??
    (typeof errorInstance?.cause === "string" ? clippedText(errorInstance.cause) : undefined);
  const hint = clippedText(record?.hint) ?? clippedText(nested?.hint);
  const code =
    clippedText(record?.code, 120) ??
    clippedText(nested?.code, 120) ??
    clippedText(record?.type, 120) ??
    clippedText(nested?.type, 120);
  const httpStatus =
    numericStatus(record?.status) ??
    numericStatus(record?.statusCode) ??
    numericStatus(nested?.status);

  return {
    message,
    ...(details ? { details } : {}),
    ...(hint ? { hint } : {}),
    ...(code ? { code } : {}),
    ...(httpStatus ? { httpStatus } : {}),
  };
}
