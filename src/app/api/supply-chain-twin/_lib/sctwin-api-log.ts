import { NextResponse } from "next/server";

type SctwinApiLogLevel = "error" | "warn";

type SctwinApiLogBase = {
  /** Always true — filter in log drains. */
  sctwinApi: true;
  level: SctwinApiLogLevel;
  ts: string;
  /** HTTP method + path pattern (no query string). */
  route: string;
  /** One of: auth, validation, readiness, catalog, unknown */
  phase: string;
  /** Stable machine code for alerts; never user/tenant text. */
  errorCode: string;
  /** Safe hint only (e.g. Error.name). No emails, ids, or request payloads. */
  detail?: string;
  /** Correlate client + server logs; from `x-request-id` / `x-correlation-id` or generated per request. */
  requestId: string;
};

const INCOMING_REQUEST_ID_HEADERS = ["x-request-id", "x-correlation-id"] as const;

/** Standard correlation header (may overlap with other gateways). */
export const SCTWIN_REQUEST_ID_HEADER = "x-request-id";

/**
 * Twin-namespaced echo of the same resolved id (Slice 64). Always equals {@link SCTWIN_REQUEST_ID_HEADER} on twin
 * `NextResponse` bodies built via {@link twinApiJson}; use either header in DevTools when tracing preview calls.
 */
export const SCTWIN_MODULE_REQUEST_ID_HEADER = "x-sctwin-request-id";

/**
 * Accepts only compact, non-whitespace ids suitable for log fields (no PII, no JSON-breaking characters).
 * Length 4–128; allows UUIDs, ULIDs, and common gateway formats.
 */
export function isSafeSctwinRequestId(value: string): boolean {
  if (value.length < 4 || value.length > 128) {
    return false;
  }
  return /^[A-Za-z0-9_.:-]+$/.test(value);
}

/**
 * Prefer client `x-request-id` or `x-correlation-id` when safe; otherwise a fresh UUID.
 * Never throws; never returns empty.
 */
export function resolveSctwinRequestId(request: Request): string {
  for (const name of INCOMING_REQUEST_ID_HEADERS) {
    const raw = request.headers.get(name)?.trim();
    if (raw && isSafeSctwinRequestId(raw)) {
      return raw.length > 128 ? raw.slice(0, 128) : raw;
    }
  }
  return crypto.randomUUID();
}

/** Echo the resolved id on twin API responses (success or error). */
export function withSctwinRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(SCTWIN_REQUEST_ID_HEADER, requestId);
  response.headers.set(SCTWIN_MODULE_REQUEST_ID_HEADER, requestId);
  return response;
}

export function twinApiJson(data: unknown, init: ResponseInit | undefined, requestId: string): NextResponse {
  return withSctwinRequestId(NextResponse.json(data, init), requestId);
}

function emit(payload: SctwinApiLogBase) {
  const line = JSON.stringify(payload);
  if (payload.level === "error") {
    console.error(line);
  } else {
    console.warn(line);
  }
}

/** Unexpected failures (typically 5xx path). */
export function logSctwinApiError(input: Omit<SctwinApiLogBase, "sctwinApi" | "level" | "ts">) {
  emit({
    sctwinApi: true,
    level: "error",
    ts: new Date().toISOString(),
    ...input,
  });
}

/** Client/validation issues without PII (optional operator signal). */
export function logSctwinApiWarn(input: Omit<SctwinApiLogBase, "sctwinApi" | "level" | "ts">) {
  emit({
    sctwinApi: true,
    level: "warn",
    ts: new Date().toISOString(),
    ...input,
  });
}
