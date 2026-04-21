/** Stable service id for health payloads and logging. */
export const APIHUB_SERVICE = "apihub" as const;

/** Current shipped phase label. */
export const APIHUB_PHASE = "P2" as const;

/** Narrow lifecycle enum for Phase 2 connector registry updates. */
export const APIHUB_CONNECTOR_STATUSES = ["draft", "active", "paused", "error"] as const;
export type ApiHubConnectorStatus = (typeof APIHUB_CONNECTOR_STATUSES)[number];

/** Allowlisted `sort` query values for `GET /api/apihub/connectors`. */
export const APIHUB_CONNECTOR_LIST_SORT_FIELDS = ["createdAt", "updatedAt", "name"] as const;
export type ApiHubConnectorListSortField = (typeof APIHUB_CONNECTOR_LIST_SORT_FIELDS)[number];

/** Allowlisted `order` query values (paired with `sort`). */
export const APIHUB_CONNECTOR_LIST_SORT_ORDERS = ["asc", "desc"] as const;
export type ApiHubConnectorListSortOrder = (typeof APIHUB_CONNECTOR_LIST_SORT_ORDERS)[number];

/** Non-secret auth mode metadata for connector setup. */
export const APIHUB_CONNECTOR_AUTH_MODES = [
  "none",
  "api_key_ref",
  "oauth_client_ref",
  "basic_ref",
] as const;
export type ApiHubConnectorAuthMode = (typeof APIHUB_CONNECTOR_AUTH_MODES)[number];

/** Operator-visible auth setup readiness states. */
export const APIHUB_CONNECTOR_AUTH_STATES = ["not_configured", "configured", "error"] as const;
export type ApiHubConnectorAuthState = (typeof APIHUB_CONNECTOR_AUTH_STATES)[number];

/** Ingestion job lifecycle statuses for API Hub ingestion pipeline. */
export const APIHUB_INGESTION_JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;
export type ApiHubIngestionJobStatus = (typeof APIHUB_INGESTION_JOB_STATUSES)[number];

/** Ingestion trigger labels for job provenance. */
export const APIHUB_INGESTION_TRIGGER_KINDS = ["manual", "api", "scheduled"] as const;
export type ApiHubIngestionTriggerKind = (typeof APIHUB_INGESTION_TRIGGER_KINDS)[number];
