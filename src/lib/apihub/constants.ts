/** Stable service id for health payloads and logging. */
export const APIHUB_SERVICE = "apihub" as const;

/** Current shipped phase label. */
export const APIHUB_PHASE = "P2" as const;

/** Narrow lifecycle enum for Phase 2 connector registry updates. */
export const APIHUB_CONNECTOR_STATUSES = ["draft", "active", "paused", "error"] as const;
export type ApiHubConnectorStatus = (typeof APIHUB_CONNECTOR_STATUSES)[number];

/**
 * Minimum trimmed `note` length when forcing a status change away from `active` while ingestion
 * jobs are still `queued` or `running` for that connector (Slice 16 guardrail).
 */
export const APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN = 12;

/** Max persisted length for `opsNote` on `ApiHubConnector` (PATCH `opsNote`). */
export const APIHUB_CONNECTOR_OPS_NOTE_MAX = 2000;

/** Max length for `authConfigRef` after trim (non-secret pointer strings only). */
export const APIHUB_AUTH_CONFIG_REF_MAX_LEN = 512;

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

export function isApiHubIngestionTriggerKind(value: string): value is ApiHubIngestionTriggerKind {
  return (APIHUB_INGESTION_TRIGGER_KINDS as readonly string[]).includes(value);
}

/**
 * Per-trigger retry budget for new ingestion runs (`maxAttempts` on the row). Retries inherit the
 * root run's `maxAttempts` so the chain stays consistent.
 */
export const APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_BY_TRIGGER = {
  api: 3,
  manual: 5,
  scheduled: 2,
} as const satisfies Record<ApiHubIngestionTriggerKind, number>;

/** Hard lower bound applied after per-trigger policy (Slice 25). */
export const APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_MIN = 1;

/** Hard upper bound applied after per-trigger policy (Slice 25). */
export const APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_CAP = 10;

export function apiHubIngestionMaxAttemptsForTrigger(triggerKind: ApiHubIngestionTriggerKind): number {
  const configured = APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_BY_TRIGGER[triggerKind];
  return Math.min(
    APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_CAP,
    Math.max(APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_MIN, configured),
  );
}

/** Inclusive upper bound for `attempt` in `attemptRange` list filter (`min-max` or single digit). */
export const APIHUB_INGESTION_ATTEMPT_RANGE_MAX = 99;

/**
 * Upper bound for `sampleSize` on mapping preview: larger requests are clamped to this many records
 * so preview work stays bounded (Slice 34).
 */
export const APIHUB_MAPPING_PREVIEW_SAMPLE_MAX = 500;
