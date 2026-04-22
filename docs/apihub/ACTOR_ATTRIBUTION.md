# API Hub — actor attribution (audit)

Mutating API Hub routes resolve an **active demo actor** (`getActorUserId()`); without it, routes return **`DEMO_ACTOR_MISSING`** (see [permissions-matrix.md](./permissions-matrix.md)).

## Where the actor is stored

| Surface | Column | `metadata` JSON |
|--------|--------|-----------------|
| **Ingestion run audit** (`apply` / `retry`) | `ApiHubIngestionRunAuditLog.actorUserId` | **`actorUserId`** duplicated for exports and log pipelines that read only JSON blobs |
| **Connector audit** | `ApiHubConnectorAuditLog.actorUserId` | Optional request-shaped fields; actor is always on the row |
| **Mapping template audit** | `ApiHubMappingTemplateAuditLog.actorUserId` | Same pattern as connectors |

Ingestion apply/retry handlers build `metadata` in `src/app/api/apihub/ingestion-jobs/[jobId]/apply/route.ts` and `retry/route.ts`; persistence uses `appendApiHubIngestionRunAuditLog` in `src/lib/apihub/ingestion-run-audit-repo.ts`.
