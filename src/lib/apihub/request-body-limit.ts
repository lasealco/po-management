/**
 * Bounded JSON body reads for API Hub routes (abuse / accidental huge payloads).
 * Uses `request.text()` once — callers must not also call `request.json()`.
 */

import { apiHubError } from "@/lib/apihub/api-error";

export type ParseApiHubRequestJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large"; message: string }
  | { ok: false; reason: "invalid_json"; message: string };

/**
 * @param maxBytes — inclusive upper bound on UTF-8 string length from `request.text()`.
 * @param options.emptyOnInvalid — when true, invalid JSON yields `{ ok: true, value: {} }` (legacy route behavior).
 */
export async function parseApiHubRequestJson(
  request: Request,
  maxBytes: number,
  options?: { emptyOnInvalid?: boolean },
): Promise<ParseApiHubRequestJsonResult> {
  const emptyOnInvalid = options?.emptyOnInvalid === true;
  const text = await request.text();
  if (text.length > maxBytes) {
    return {
      ok: false,
      reason: "too_large",
      message: `JSON body exceeds ${maxBytes} bytes (API Hub limit). Reduce payload size or split the request.`,
    };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch {
    if (emptyOnInvalid) {
      return { ok: true, value: {} };
    }
    return { ok: false, reason: "invalid_json", message: "Request body is not valid JSON." };
  }
}

/** Standard route helper: **413** when over limit; **400** invalid JSON unless `emptyOnInvalid`. */
export async function parseApiHubPostJsonForRoute(
  request: Request,
  requestId: string,
  maxBytes: number,
  options?: { emptyOnInvalid?: boolean },
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const parsed = await parseApiHubRequestJson(request, maxBytes, options);
  if (!parsed.ok) {
    if (parsed.reason === "too_large") {
      return { ok: false, response: apiHubError(413, "PAYLOAD_TOO_LARGE", parsed.message, requestId) };
    }
    return { ok: false, response: apiHubError(400, "INVALID_JSON", parsed.message, requestId) };
  }
  return { ok: true, value: parsed.value };
}
