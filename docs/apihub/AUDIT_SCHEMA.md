# API Hub — audit schema (v1)

Slice 63 normalizes persisted audit vocabulary so integrations and analytics can rely on one pattern.

## Action strings (`action` column)

All values use **`apihub.<resource>.<event>`** (lowercase, dots between segments; multi-word events use underscores after the resource).

| Table | Example `action` values |
|-------|-------------------------|
| `ApiHubConnectorAuditLog` | `apihub.connector.created`, `apihub.connector.lifecycle_updated`, `apihub.connector.ops_note_updated`, `apihub.connector.auth_config_ref_updated` |
| `ApiHubMappingTemplateAuditLog` | `apihub.mapping_template.created`, `apihub.mapping_template.updated`, `apihub.mapping_template.deleted` |
| `ApiHubIngestionRunAuditLog` | `apihub.ingestion_run.apply`, `apihub.ingestion_run.retry` |

Constants live in `src/lib/apihub/audit-contract.ts`. Migration `20260430110000_apihub_audit_action_normalize` rewrites legacy rows (`connector.*`, `mapping_template_*`, `apply` / `retry`).

## Ingestion run audit `metadata` JSON

New rows include:

| Field | Type | Purpose |
|-------|------|---------|
| `schemaVersion` | `1` | Forward-compatible parsing |
| `resourceType` | `"ingestion_run"` | Aligns with `action` prefix |
| `requestId`, `verb`, `resultCode`, `httpStatus`, `outcome` | varies | Operator / SIEM diagnostics (existing) |
| `actorUserId` | string | Duplicate of column for JSON-only exports (Slice 62) |

Older rows may omit `schemaVersion` / `resourceType`; treat missing `schemaVersion` as legacy.

## Alert / conflict queries

`ingestion-alerts-summary-repo` and `ingestion-apply-conflicts-repo` filter on canonical **`apihub.ingestion_run.*`** values and still include legacy `apply` / `retry` until all environments have run the normalize migration. UI DTOs expose `source: "apply" | "retry"` derived from either form.
