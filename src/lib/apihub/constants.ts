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

/** Display name for persisted mapping templates (Slice 35). */
export const APIHUB_MAPPING_TEMPLATE_NAME_MAX = 200;

/** Optional description length cap for mapping templates. */
export const APIHUB_MAPPING_TEMPLATE_DESCRIPTION_MAX = 2000;

/** Max rule rows stored on a single mapping template. */
export const APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT = 200;

/** Optional operator note stored on mapping template audit rows (PATCH/DELETE). */
export const APIHUB_MAPPING_TEMPLATE_AUDIT_NOTE_MAX = 500;

/** Mapping analysis job lifecycle (P2 async pipeline). */
export const APIHUB_MAPPING_ANALYSIS_JOB_STATUSES = ["queued", "processing", "succeeded", "failed"] as const;
export type ApiHubMappingAnalysisJobStatus = (typeof APIHUB_MAPPING_ANALYSIS_JOB_STATUSES)[number];

/** Max sample records accepted on `POST …/mapping-analysis-jobs` (bounded work). */
export const APIHUB_MAPPING_ANALYSIS_MAX_RECORDS = 80;

/** Max operator note length on analysis job create. */
export const APIHUB_MAPPING_ANALYSIS_NOTE_MAX = 500;

/** Max target-field hints on create. */
export const APIHUB_MAPPING_ANALYSIS_TARGET_FIELDS_MAX = 120;

/** Engine id for deterministic proposals (no LLM). Bump when heuristic rules change materially (P2). */
export const APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC = "deterministic_heuristic_v2" as const;

/** Engine id when OpenAI structured JSON is used successfully. */
export const APIHUB_MAPPING_ANALYSIS_ENGINE_OPENAI = "openai_structured_json_v1" as const;

/** Max rows materialized into a single staging batch (bounded writes). */
export const APIHUB_STAGING_BATCH_MAX_ROWS = 500;

/** Max rows returned for staging batch detail (`GET …/staging-batches/:id` `rowLimit` query). */
export const APIHUB_STAGING_BATCH_DETAIL_ROW_LIMIT_MAX = 300;

/** Downstream apply targets for persisted staging batches (requires module grants in addition to org.apihub). */
export const APIHUB_STAGING_APPLY_TARGETS = ["sales_order", "purchase_order", "control_tower_audit"] as const;
export type ApiHubStagingApplyTarget = (typeof APIHUB_STAGING_APPLY_TARGETS)[number];

/**
 * P3 — match-key policy when applying **ingestion runs** downstream (staging apply stays create-only).
 * - `none`: create-only; optional refs are not pre-checked for duplicates.
 * - `sales_order_external_ref`: fail when `externalRef` is set and a SO already exists for tenant+ref.
 * - `purchase_order_buyer_reference`: fail when `buyerReference` is set and a PO already exists for tenant+ref.
 */
export const APIHUB_INGESTION_APPLY_MATCH_KEYS = [
  "none",
  "sales_order_external_ref",
  "purchase_order_buyer_reference",
] as const;
export type ApiHubIngestionApplyMatchKey = (typeof APIHUB_INGESTION_APPLY_MATCH_KEYS)[number];

/**
 * Ingestion apply only (staging stays create-only). **`upsert`** updates an existing SO/PO when the
 * corresponding **`matchKey`** is set (`sales_order_external_ref` / `purchase_order_buyer_reference`).
 */
export const APIHUB_INGESTION_APPLY_WRITE_MODES = ["create_only", "upsert"] as const;
export type ApiHubIngestionApplyWriteMode = (typeof APIHUB_INGESTION_APPLY_WRITE_MODES)[number];

export function isApiHubIngestionApplyWriteMode(value: string): value is ApiHubIngestionApplyWriteMode {
  return (APIHUB_INGESTION_APPLY_WRITE_MODES as readonly string[]).includes(value);
}

/** Whether `upsert` is allowed for this target + matchKey (CT audit is always create-only). */
export function apiHubIngestionUpsertAllowed(
  target: ApiHubStagingApplyTarget,
  matchKey: ApiHubIngestionApplyMatchKey,
): boolean {
  if (target === "control_tower_audit") return false;
  if (target === "sales_order" && matchKey === "sales_order_external_ref") return true;
  if (target === "purchase_order" && matchKey === "purchase_order_buyer_reference") return true;
  return false;
}

/**
 * PO upsert line strategy (ingestion only). **`merge_by_line_no`** updates/creates one line per row;
 * **`replace_all`** replaces all lines using **all rows that share the same `buyerReference`** in one apply.
 */
export const APIHUB_PURCHASE_ORDER_LINE_MERGE_MODES = ["merge_by_line_no", "replace_all"] as const;
export type ApiHubPurchaseOrderLineMergeMode = (typeof APIHUB_PURCHASE_ORDER_LINE_MERGE_MODES)[number];

export function isApiHubPurchaseOrderLineMergeMode(value: string): value is ApiHubPurchaseOrderLineMergeMode {
  return (APIHUB_PURCHASE_ORDER_LINE_MERGE_MODES as readonly string[]).includes(value);
}

/** `purchaseOrderLineMerge` is only meaningful for PO + buyer ref + upsert. */
export function apiHubPurchaseOrderLineMergeAllowed(
  target: ApiHubStagingApplyTarget,
  matchKey: ApiHubIngestionApplyMatchKey,
  writeMode: ApiHubIngestionApplyWriteMode,
): boolean {
  return (
    target === "purchase_order" &&
    matchKey === "purchase_order_buyer_reference" &&
    writeMode === "upsert"
  );
}

/**
 * Default max JSON body size (bytes) for API Hub POST/PATCH — abuse guard.
 * Heavy routes (mapping preview, analysis jobs, diff, large templates) use {@link APIHUB_JSON_BODY_MAX_BYTES_LARGE}.
 */
export const APIHUB_JSON_BODY_MAX_BYTES = 256 * 1024;

/** Larger JSON payloads: mapping analysis, preview/export, rule diff, template create-from-rules. */
export const APIHUB_JSON_BODY_MAX_BYTES_LARGE = 1024 * 1024;
