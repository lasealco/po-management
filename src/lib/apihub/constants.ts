/** Stable service id for health payloads and logging. */
export const APIHUB_SERVICE = "apihub" as const;

/** Current shipped phase label for health/discovery payloads. */
export const APIHUB_PHASE = "P2" as const;

/** Narrow lifecycle enum for Phase 2 connector registry updates. */
export const APIHUB_CONNECTOR_STATUSES = ["draft", "active", "paused", "error"] as const;
export type ApiHubConnectorStatus = (typeof APIHUB_CONNECTOR_STATUSES)[number];
