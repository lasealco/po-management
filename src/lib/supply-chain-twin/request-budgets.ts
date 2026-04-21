/** Shared request guardrails for Supply Chain Twin APIs. */

/** Standard max page size for keyset list endpoints. */
export const TWIN_LIST_LIMIT_MAX = 100;

/** Default page size for most list endpoints. */
export const TWIN_LIST_LIMIT_DEFAULT = 50;

/** Hard cap on `until - since` for events query windows. */
export const TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS = 31;

/** Hard cap for events export rows before returning a 400 validation error. */
export const TWIN_EVENTS_EXPORT_MAX_ROWS = 1000;
