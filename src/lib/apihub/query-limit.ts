/** Default page size for API Hub list endpoints (`limit` query). */
export const APIHUB_LIST_LIMIT_DEFAULT = 20;

/** Inclusive floor for parsed `limit` (must be ≥ 1 for Prisma `take`). */
export const APIHUB_LIST_LIMIT_MIN = 1;

/** Hard cap so list routes stay bounded. */
export const APIHUB_LIST_LIMIT_MAX = 100;

export type ApiHubListLimitParseResult =
  | { ok: true; limit: number }
  | { ok: false; raw: string };

/**
 * Parse list `limit` from a query value: missing/blank → default; non-finite → invalid;
 * finite values are truncated and clamped to [{@link APIHUB_LIST_LIMIT_MIN}, {@link APIHUB_LIST_LIMIT_MAX}].
 */
export function parseApiHubListLimitQueryInput(raw: string | null): ApiHubListLimitParseResult {
  if (raw == null || raw.trim() === "") {
    return { ok: true, limit: APIHUB_LIST_LIMIT_DEFAULT };
  }
  const trimmed = raw.trim();
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { ok: false, raw: trimmed };
  }
  return {
    ok: true,
    limit: Math.min(Math.max(Math.trunc(n), APIHUB_LIST_LIMIT_MIN), APIHUB_LIST_LIMIT_MAX),
  };
}

export function parseApiHubListLimitFromUrl(url: URL, paramName = "limit"): ApiHubListLimitParseResult {
  return parseApiHubListLimitQueryInput(url.searchParams.get(paramName));
}
