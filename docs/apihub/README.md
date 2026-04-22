# API hub — documentation home

This folder is the **documentation home** for **integration / ingestion APIs and UX**: how external data and files enter the platform, how operators confirm mappings, and how runs are **repeatable** and **auditable**.

**Browse on GitHub (public):** [`lasealco/po-management` → `docs/apihub/`](https://github.com/lasealco/po-management/tree/main/docs/apihub)

## Specs (markdown)

| Document | Purpose |
|----------|---------|
| [integrations-ai-assisted-ingestion.md](./integrations-ai-assisted-ingestion.md) | End-to-end product + technical spec: AI-assisted ingestion, templates, API + file parity, guardrails, phased delivery |
| [apply-operator-runbook.md](./apply-operator-runbook.md) | **Slice 50:** Operator runbook — apply (live + dry-run), idempotency replay, retry, 409 codes, rollback stub, triage via `/apihub` Alerts + Apply conflicts |
| [permissions-matrix.md](./permissions-matrix.md) | **Slice 51:** Route-level access — public vs demo tenant + demo actor; aligns with `src/app/api/apihub/**` guards and `/apihub` `ApihubGate` |
| [RUNBOOK.md](./RUNBOOK.md) | Docs-only execution runbook for API Hub updates, scope boundaries, and PR checklist |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | **Slice 59:** Pre/post deploy checklist and `npm run smoke:apihub` sequence |
| [CLOSEOUT_AUDIT.md](./CLOSEOUT_AUDIT.md) | **Slice 60:** Module handoff — scope inventory, residual risks (R1–R9), sign-off checklist |
| [TENANT_SCOPING.md](./TENANT_SCOPING.md) | **Slice 61:** Tenant isolation — repo inventory + scoped mutation patterns |
| [ACTOR_ATTRIBUTION.md](./ACTOR_ATTRIBUTION.md) | **Slice 62:** Actor id on audit rows and in JSON metadata where exports need it |
| [AUDIT_SCHEMA.md](./AUDIT_SCHEMA.md) | **Slice 63:** Canonical `action` strings and ingestion-run audit `metadata` envelope |

**Gap map (spec ↔ code):** [GAP_MAP.md](./GAP_MAP.md)

## In-app entry (P0+)

- Authenticated demo session: **`/apihub`** — **Mapping analysis jobs** (P2 async proposals + staging preview), **Connectors**, **mapping templates** (list / create / edit / delete + diff + preview export panels), **Ingestion runs** ops summary, **Alerts** (apply/retry failure summary), **Apply conflicts** (apply 4xx audit table), and links to demo session settings (see [GAP_MAP](./GAP_MAP.md) and [apply-operator-runbook](./apply-operator-runbook.md)).

## Route index (parity with `src/app/api/apihub/**`)

Authoritative guard semantics: [permissions-matrix.md](./permissions-matrix.md). Every path below except **`GET /api/apihub/health`** requires **demo tenant** and **active demo actor**.

### Discovery (public)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/apihub/health` | JSON `{ ok, service, phase }` — no auth |

### Connectors (registry)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`, `POST` | `/api/apihub/connectors` | List / create |
| `PATCH` | `/api/apihub/connectors/:connectorId` | Update (status, `lastSyncAt`, health summary, etc.) |
| `GET` | `/api/apihub/connectors/:connectorId/audit` | Paginated connector audit |
| `GET` | `/api/apihub/connectors/:connectorId/health` | Live health probe (no secrets) |

### Ingestion jobs (lifecycle)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`, `POST` | `/api/apihub/ingestion-jobs` | List (cursor + filters) / create |
| `GET` | `/api/apihub/ingestion-jobs/ops-summary` | Ops summary |
| `GET`, `PATCH` | `/api/apihub/ingestion-jobs/:jobId` | Detail / update |
| `GET` | `/api/apihub/ingestion-jobs/:jobId/timeline` | Timeline |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/retry` | Retry |

### Mapping analysis jobs (P2)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/apihub/mapping-analysis-jobs` | List recent jobs; `limit` query (same bounds as other list routes). |
| `POST` | `/api/apihub/mapping-analysis-jobs` | Queue job: JSON `{ records: object[], targetFields?: string[], note?: string }`. Schedules processing via `after()` (deterministic heuristic; no secrets). |
| `GET` | `/api/apihub/mapping-analysis-jobs/:jobId` | Job detail, `outputProposal.rules`, optional embedded **`stagingPreview`** (mapping engine dry-run on sample records). |
| `POST` | `/api/apihub/mapping-analysis-jobs/:jobId/process` | Manually claim a **queued** job (local dev / recovery); idempotent. |

**Prisma:** `ApiHubMappingAnalysisJob` (`20260430120000_apihub_mapping_analysis_job`).

## Mapping templates, preview, diff, and apply (shipped)

The sections below expand **mapping** and **apply** contracts (preview/export, templates, diff, apply, conflicts, alerts). Request id: optional `x-request-id` or `x-correlation-id` (validated pattern; echoed as `x-request-id` on responses). Same demo session gates as the route index above.

### Preview (per ingestion run)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/apihub/ingestion-jobs/:jobId/mapping-preview` | Dry-run `records` + `rules[]` against the mapping engine; optional `sampleSize` (capped) and `sampling` metadata in the JSON body. |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/mapping-preview/export` | Same body as preview plus required **`format`**: `json` (full report: sampling + per-record `mapped` + `issues`) or `csv` (one row per issue; RFC4180-style escaping). Returns `Content-Disposition: attachment`. |

**Rules shape:** each rule is an object with `sourcePath`, `targetField`, optional `transform` (`identity` \| `trim` \| `upper` \| `lower` \| `number` \| `iso_date` \| `boolean` \| `currency`), optional `required` boolean. Cross-rule validation (duplicate `targetField`, invalid path syntax) runs on the server.

### Templates (tenant-scoped)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/apihub/mapping-templates` | List templates; `limit` query (1–100, default 20). |
| `POST` | `/api/apihub/mapping-templates` | Create: `name`, optional `description`, `rules[]` (max count enforced). Writes an audit row `apihub.mapping_template.created`. |
| `GET` | `/api/apihub/mapping-templates/:templateId` | Read one template. |
| `PATCH` | `/api/apihub/mapping-templates/:templateId` | Partial update (`name` / `description` / `rules`); optional `note` stored on audit only. |
| `DELETE` | `/api/apihub/mapping-templates/:templateId` | Deletes row after audit `apihub.mapping_template.deleted`. |
| `GET` | `/api/apihub/mapping-templates/:templateId/audit` | Paginated audit (`limit`, `page`); `templateId` is not FK-bound so history survives delete. |

**Prisma:** `ApiHubMappingTemplate`, `ApiHubMappingTemplateAuditLog` (migrations under `prisma/migrations/`).

### Rule diff (no run context)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/apihub/mapping-diff` | Body: `baselineRules[]`, `compareRules[]` (same rule validation as preview). Response: `{ diff: { summary, added, removed, changed, unchanged } }` keyed by `targetField`. |

### Apply (ingestion run)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/apihub/ingestion-jobs/:jobId/apply` | Marks apply outcome for a **succeeded** run (409 conflict codes for not succeeded / already applied / blocked). Success body includes **`targetSummary`** `{ created, updated, skipped }` (from run `resultSummary` JSON when it carries those fields / nested `targetSummary`; otherwise defaults to one logical update). Dry-run **`writeSummary`** includes the same shape as **`targetSummary`** (zeros when apply would not run). **`dryRun`:** query `?dryRun=1` (or JSON body `{ "dryRun": true }`) returns **200** with `{ dryRun, writeSummary, run }` only (no `appliedAt` write). **`idempotency-key`** header or `{ "idempotencyKey" }` in JSON (same precedence as retry, max 128 chars): first response is stored per tenant+key; replays return the same status/body plus `idempotentReplay: true` when the same run id and dry-run flag match, otherwise **409** `APPLY_IDEMPOTENCY_KEY_CONFLICT`. |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/apply/rollback` | **Stub (Slice 44):** returns **200** with `{ rollback: { stub, implemented: false, effect: "none", message }, run }` and does **not** mutate `appliedAt` or downstream data. **404** if the run is missing. |
| `GET` | `/api/apihub/ingestion-apply-conflicts` | **Slice 46:** tenant-scoped list of **apply** attempts whose audit `metadata.outcome` is `client_error` (4xx apply responses), newest first. Query: `limit` (default 20, max 100), optional `cursor` (opaque; use `nextCursor` from prior page). Response: `{ conflicts: [...], nextCursor }`. **Slice 47 UI:** `/apihub` → **Apply conflicts** panel (`#apply-conflicts`) with table, refresh, load-more, and scaffold actions (copy diagnostics, open job JSON, disabled “Mark reviewed”). |
| `GET` | `/api/apihub/ingestion-alerts-summary` | **Slice 48:** tenant-scoped **alert-style** summary over recent **apply** and **retry** audit rows with `metadata.outcome === "client_error"`. Query: `limit` (default 20, capped at **50** server-side). Response: `{ generatedAt, limit, counts: { error, warn, info }, alerts: [...] }` for UI and integrations. **Slice 49 UI:** `/apihub` → **Alerts** panel (`#ingestion-alerts`) with counts, priority banner, and table (server-hydrated on load + Refresh). |

**Ingestion lifecycle audit (Slice 45, Slice 62, Slice 63):** successful and failed **`POST .../apply`** and **`POST .../retry`** calls append a row to **`ApiHubIngestionRunAuditLog`** (`action` = `apihub.ingestion_run.apply` \| `apihub.ingestion_run.retry`, `actorUserId` column plus `metadata` JSON with `schemaVersion`, `resourceType`, `actorUserId`, `requestId`, `verb`, `resultCode`, `httpStatus`, `outcome`, idempotency flags, and run correlation fields). Failures to write audit are logged and do not change the HTTP response. Canonical vocabulary: [AUDIT_SCHEMA.md](./AUDIT_SCHEMA.md).

Validation errors use the shared **`VALIDATION_ERROR`** envelope with `details.issues` and `details.summary` (including `bySeverity` where applicable).

## Related material elsewhere

- **Control Tower** inbound / integration context: `docs/controltower/` (PDF pack + `GAP_MAP.md`).
- **Agent execution list (integration hub slice):** [`../engineering/agent-todos/integration-hub.md`](../engineering/agent-todos/integration-hub.md)

## Naming

- **`docs/apihub/`** = docs and product language for this initiative.
- **Application routes** use `/apihub` for the P0 shell; final product naming is tracked in the spec open decisions. Keep this README, [GAP_MAP](./GAP_MAP.md), and the [phased delivery table](./integrations-ai-assisted-ingestion.md#8-phased-delivery-proposal) aligned when shipping phases.
