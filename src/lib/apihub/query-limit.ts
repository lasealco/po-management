/** Default page size for API Hub list endpoints (`limit` query). */
export const APIHUB_LIST_LIMIT_DEFAULT = 20;

/** Inclusive floor for parsed `limit` (must be ≥ 1 for Prisma `take`). */
export const APIHUB_LIST_LIMIT_MIN = 1;

/** Hard cap so list routes stay bounded. */
export const APIHUB_LIST_LIMIT_MAX = 100;

/**
 * Parse `limit` from a raw query string: finite integers are truncated and clamped;
 * missing/empty/NaN/±Infinity fall back to {@link APIHUB_LIST_LIMIT_DEFAULT}.
 */
export function parseApiHubListLimitParam(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") {
    return APIHUB_LIST_LIMIT_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return APIHUB_LIST_LIMIT_DEFAULT;
  }
  return Math.min(Math.max(Math.trunc(n), APIHUB_LIST_LIMIT_MIN), APIHUB_LIST_LIMIT_MAX);
}

/** Read `limit` (or `paramName`) from a URL's query string with shared caps. */
export function parseApiHubListLimitFromUrl(url: URL, paramName = "limit"): number {
  return parseApiHubListLimitParam(url.searchParams.get(paramName));
}
