/**
 * Canonical API Hub audit vocabulary (Slice 63).
 * Persisted `action` values use `apihub.<resource>.<event>`; ingestion-run audit `metadata` includes `schemaVersion` + `resourceType`.
 */

export const APIHUB_AUDIT_METADATA_SCHEMA_VERSION = 1 as const;

export const APIHUB_AUDIT_RESOURCE_TYPE_INGESTION_RUN = "ingestion_run" as const;

/** Connector registry audit rows (`ApiHubConnectorAuditLog.action`). */
export const APIHUB_AUDIT_ACTION_CONNECTOR_CREATED = "apihub.connector.created" as const;
export const APIHUB_AUDIT_ACTION_CONNECTOR_LIFECYCLE_UPDATED = "apihub.connector.lifecycle_updated" as const;
export const APIHUB_AUDIT_ACTION_CONNECTOR_OPS_NOTE_UPDATED = "apihub.connector.ops_note_updated" as const;
export const APIHUB_AUDIT_ACTION_CONNECTOR_AUTH_CONFIG_REF_UPDATED = "apihub.connector.auth_config_ref_updated" as const;

/** Mapping template audit rows (`ApiHubMappingTemplateAuditLog.action`). */
export const APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_CREATED = "apihub.mapping_template.created" as const;
export const APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_UPDATED = "apihub.mapping_template.updated" as const;
export const APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_DELETED = "apihub.mapping_template.deleted" as const;

/** Ingestion run lifecycle audit (`ApiHubIngestionRunAuditLog.action`). */
export const APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY = "apihub.ingestion_run.apply" as const;
export const APIHUB_AUDIT_ACTION_INGESTION_RUN_RETRY = "apihub.ingestion_run.retry" as const;

export type ApiHubIngestionRunAuditAction =
  | typeof APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY
  | typeof APIHUB_AUDIT_ACTION_INGESTION_RUN_RETRY;

/** Base fields included on every new ingestion-run audit `metadata` JSON object. */
export function apiHubIngestionRunAuditMetadataEnvelope(): {
  schemaVersion: typeof APIHUB_AUDIT_METADATA_SCHEMA_VERSION;
  resourceType: typeof APIHUB_AUDIT_RESOURCE_TYPE_INGESTION_RUN;
} {
  return {
    schemaVersion: APIHUB_AUDIT_METADATA_SCHEMA_VERSION,
    resourceType: APIHUB_AUDIT_RESOURCE_TYPE_INGESTION_RUN,
  };
}
