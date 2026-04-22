import { apiClientErrorMessage, readApiErrorTextFromJson, readApiResponseErrorCode } from "@/lib/api-client-error";

/** Stable Twin API error-code registry used by route handlers. */
export const TWIN_API_ERROR_CODES = {
  QUERY_VALIDATION_FAILED: "QUERY_VALIDATION_FAILED",
  INVALID_CURSOR: "INVALID_CURSOR",
  FORMAT_INVALID: "FORMAT_INVALID",
  EXPORT_ROW_CAP_EXCEEDED: "EXPORT_ROW_CAP_EXCEEDED",
  BODY_JSON_INVALID: "BODY_JSON_INVALID",
  BODY_VALIDATION_FAILED: "BODY_VALIDATION_FAILED",
  INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
  INVALID_TWIN_INGEST_TYPE: "INVALID_TWIN_INGEST_TYPE",
  PATH_ID_INVALID: "PATH_ID_INVALID",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  TWIN_INGEST_PAYLOAD_TOO_LARGE: "TWIN_INGEST_PAYLOAD_TOO_LARGE",
  TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE: "TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE",
  TIMEOUT_BUDGET_EXCEEDED: "TIMEOUT_BUDGET_EXCEEDED",
} as const;

export type TwinApiErrorCode = (typeof TWIN_API_ERROR_CODES)[keyof typeof TWIN_API_ERROR_CODES];

const TWIN_API_ERROR_CODE_SET = new Set<string>(Object.values(TWIN_API_ERROR_CODES));

/** Type guard for narrowing unknown `code` values from Twin API JSON. */
export function isTwinApiErrorCode(value: unknown): value is TwinApiErrorCode {
  return typeof value === "string" && TWIN_API_ERROR_CODE_SET.has(value);
}

/**
 * Extracts a stable Twin `code` from unknown response JSON.
 * Returns `null` for missing/unrecognized values.
 */
export function parseTwinApiErrorCode(body: unknown): TwinApiErrorCode | null {
  if (typeof body !== "object" || body == null) {
    return null;
  }
  const raw = (body as { code?: unknown }).code;
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toUpperCase();
  return isTwinApiErrorCode(normalized) ? normalized : null;
}

/** Raw `code` from Twin API JSON (any non-empty trimmed value), including HTTP contract codes like `FORBIDDEN`. */
export const readTwinApiResponseErrorCode = readApiResponseErrorCode;

/** Re-export of `apiClientErrorMessage` from `@/lib/api-client-error` for Twin call sites. */
export const twinApiClientErrorMessage = apiClientErrorMessage;

/**
 * Parses common Twin API error payload shape from unknown JSON:
 * `{ error?: string, code?: TwinApiErrorCode }`.
 */
export function parseTwinApiErrorBody(body: unknown): { code: TwinApiErrorCode | null; error: string | null } {
  const code = parseTwinApiErrorCode(body);
  const error = readApiErrorTextFromJson(body);
  return { code, error };
}

/** Shared copy mapping for events-export UI error messages. */
export function getTwinEventsExportErrorMessage(body: unknown): string {
  const responseCode = readTwinApiResponseErrorCode(body)?.toUpperCase() ?? null;
  const parsed = parseTwinApiErrorBody(body);
  const { code, error } = parsed;

  if (responseCode === "FORBIDDEN" || responseCode === "UNAUTHORIZED") {
    return error ?? "You do not have access to export twin events for this workspace.";
  }
  if (responseCode === "UNHANDLED" || responseCode === "UNAVAILABLE") {
    return error ?? "Export failed due to a server issue. Retry in a moment.";
  }
  if (responseCode === "NOT_FOUND") {
    return error ?? "Export could not be completed.";
  }

  if (code === TWIN_API_ERROR_CODES.QUERY_VALIDATION_FAILED) {
    return "Export filters are invalid. Check time range and filter values, then retry.";
  }
  if (code === TWIN_API_ERROR_CODES.EXPORT_ROW_CAP_EXCEEDED) {
    return "Export is too large for one file. Narrow filters (time range/type) and try again.";
  }
  if (code === TWIN_API_ERROR_CODES.FORMAT_INVALID) {
    return "Export format is invalid. Retry using CSV or JSON.";
  }
  return error ?? "Export failed.";
}
