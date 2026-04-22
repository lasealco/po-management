/** Client-safe helpers for JSON API errors shaped as `{ error?, message?, code? }` (matches `toApiErrorResponse` bodies). */

export function readApiResponseErrorCode(body: unknown): string | null {
  if (typeof body !== "object" || body == null) {
    return null;
  }
  const raw = (body as { code?: unknown }).code;
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export function readApiErrorTextFromJson(body: unknown): string | null {
  const hasObjectBody = typeof body === "object" && body != null;
  const rawError =
    hasObjectBody && "error" in body && typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error.trim()
      : null;
  const rawMessage =
    hasObjectBody && "message" in body && typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message.trim()
      : null;
  const error = rawError && rawError.length > 0 ? rawError : rawMessage && rawMessage.length > 0 ? rawMessage : null;
  return error && error.length > 0 ? error : null;
}

/**
 * Single-line message for UI: prefers server `error` / `message`, then `fallback`,
 * and appends ` (code)` when a machine code is present and not already in the text.
 */
export function apiClientErrorMessage(body: unknown, fallback: string): string {
  const error = readApiErrorTextFromJson(body);
  const rawCode = readApiResponseErrorCode(body);
  const base = error ?? fallback;
  if (!rawCode) {
    return base;
  }
  const codeUpper = rawCode.toUpperCase();
  if (base.toUpperCase().includes(codeUpper)) {
    return base;
  }
  return `${base} (${rawCode})`;
}
