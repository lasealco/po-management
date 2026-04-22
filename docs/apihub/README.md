# API hub — documentation home

This folder is the **documentation home** for **integration / ingestion APIs and UX**: how external data and files enter the platform, how operators confirm mappings, and how runs are **repeatable** and **auditable**.

**Browse on GitHub (public):** [`lasealco/po-management` → `docs/apihub/`](https://github.com/lasealco/po-management/tree/main/docs/apihub)

## Specs (markdown)

| Document | Purpose |
|----------|---------|
| [integrations-ai-assisted-ingestion.md](./integrations-ai-assisted-ingestion.md) | End-to-end product + technical spec: AI-assisted ingestion, templates, API + file parity, guardrails, phased delivery |
| [ai-upload-playbook-catalog-tariffs.md](./ai-upload-playbook-catalog-tariffs.md) | **Customer-facing playbook (internal):** AI for products, inventory, ASN, ocean FCL, trucking/air/LCL — structured extract vs deterministic pricing; “training” = schema + glossary + staging |
| [apply-operator-runbook.md](./apply-operator-runbook.md) | **Slice 50:** Operator runbook — apply (live + dry-run), idempotency replay, retry, 409 codes, rollback stub, triage via `/apihub` Alerts + Apply conflicts |
| [permissions-matrix.md](./permissions-matrix.md) | **Slice 51:** Route-level access — public vs demo tenant + demo actor; aligns with `src/app/api/apihub/**` guards and `/apihub` `ApihubGate` |
| [RUNBOOK.md](./RUNBOOK.md) | Docs-only execution runbook for API Hub updates, scope boundaries, and PR checklist |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | **Slice 59:** Pre/post deploy checklist and `npm run smoke:apihub` sequence |
| [product-completion-v1.md](./product-completion-v1.md) | **Definition of done:** happy path, permissions, data safety, ops, payload/time limits |
| [CLOSEOUT_AUDIT.md](./CLOSEOUT_AUDIT.md) | **Slice 60:** Module handoff — scope inventory, residual risks (R1–R9), sign-off checklist |
| [TENANT_SCOPING.md](./TENANT_SCOPING.md) | **Slice 61:** Tenant isolation — repo inventory + scoped mutation patterns |
| [ACTOR_ATTRIBUTION.md](./ACTOR_ATTRIBUTION.md) | **Slice 62:** Actor id on audit rows and in JSON metadata where exports need it |
| [AUDIT_SCHEMA.md](./AUDIT_SCHEMA.md) | **Slice 63:** Canonical `action` strings and ingestion-run audit `metadata` envelope |
| [downstream-apply-semantics.md](./downstream-apply-semantics.md) | **R3:** Staging vs ingestion downstream apply — `matchKey`, `writeMode`, PO line merge, atomicity |

**Gap map (spec ↔ code):** [GAP_MAP.md](./GAP_MAP.md)

## In-app entry (P0+)

- Authenticated demo session: **`/apihub`** — **Mapping analysis jobs** (P2 async proposals + staging preview), **Connectors**, **mapping templates** (list / create / edit / delete + diff + preview export panels), **Ingestion runs** ops summary, **Alerts** (apply/retry failure summary), **Apply conflicts** (apply 4xx audit table), and links to demo session settings (see [GAP_MAP](./GAP_MAP.md) and [apply-operator-runbook](./apply-operator-runbook.md)).

## Route index (parity with `src/app/api/apihub/**`)

Authoritative guard semantics: [permissions-matrix.md](./permissions-matrix.md). Every path below except **`GET /api/apihub/health`** requires **demo tenant**, **active demo actor**, and **`org.apihub`** grants (**view** for reads, **edit** for writes). Mapping analysis may use OpenAI when **`APIHUB_OPENAI_API_KEY`** or **`OPENAI_API_KEY`** is set; optional **`APIHUB_OPENAI_MODEL`** (default `gpt-4o-mini`).

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
| `POST` | `/api/apihub/mapping-analysis-jobs` | Queue job: JSON `{ records: object[], targetFields?: string[], note?: string }`. Schedules processing via `after()` **and** relies on cron (below) if `after()` does not run (serverless). |
| `GET` | `/api/apihub/mapping-analysis-jobs/:jobId` | Job detail, `outputProposal.rules`, optional **`outputProposal.llm`** (attempted/used/model/error), optional embedded **`stagingPreview`**. |
| `POST` | `/api/apihub/mapping-analysis-jobs/:jobId/process` | Manually claim a **queued** job (local dev / recovery); idempotent. |

### Import assistant (guided chat)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/apihub/import-assistant/chat` | Bounded JSON body: chat turn for import guidance (`messages`, optional hints). **`org.apihub` → view**; same demo session gates as other routes. |

### ApiHub cron worker (mapping analysis)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`, `POST` | `/api/cron/apihub-mapping-analysis-jobs` | **Bearer `CRON_SECRET`**. Fails stale **`running`** ingestion runs; **reclaims** stale **`processing`** mapping-analysis jobs; drains **`queued`** jobs with a Postgres **`SKIP LOCKED`** claim (parallelism **`APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL`**, default **1**, max **5**; batch **`limit`** default **5**, max **20**). Optional **Upstash** (`UPSTASH_REDIS_REST_URL` + token): skips mapping drain when **`mappingSweepSkipped: redis_lock_busy`**. Root **`vercel.json`**: `*/10 * * * *` UTC (Pro). |

### Staging batches (persisted preview rows)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`, `POST` | `/api/apihub/staging-batches` | List recent batches / create from **`mappingAnalysisJobId`** (succeeded job only; row cap server-side). |
| `GET` | `/api/apihub/staging-batches/:batchId` | Batch metadata + rows (`rowLimit` query). |
| `POST` | `/api/apihub/staging-batches/:batchId/apply` | Apply **open** batch rows to downstream modules: JSON `{ target: "sales_order" \| "purchase_order" \| "control_tower_audit", dryRun?: boolean }`. Requires **`org.apihub` → edit** plus **`org.orders` → edit** (SO/PO targets) or **`org.controltower` → edit** (CT audit). **Staging stays create-only** for SO/PO (no `matchKey` / `upsert`): duplicate `externalRef` / `buyerReference` are **not** pre-checked. **SO** rows need `mappedRecord.customerCrmAccountId` (+ optional `soNumber`, `externalRef`, `requestedDeliveryDate`). **PO** rows need `supplierId`, `productId`, `quantity`, `unitPrice` (+ optional line/title/buyer refs). **CT audit** rows optionally set `mappedRecord.shipmentId` (must exist). Live apply sets batch **`promoted`** and **`appliedAt`**. See [downstream-apply-semantics.md](./downstream-apply-semantics.md). |
| `POST` | `/api/apihub/staging-batches/:batchId/discard` | Mark an **open** batch that was **never applied** as **`discarded`** (operator cleanup). **409** if already promoted/applied. |

**Prisma:** `ApiHubMappingAnalysisJob` (`20260430120000_apihub_mapping_analysis_job`); `ApiHubStagingBatch`, `ApiHubStagingRow` (`20260430140000_apihub_staging_batch`, `20260430150000_apihub_staging_batch_apply` for `appliedAt` / `applySummary`).

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
| `POST` | `/api/apihub/mapping-templates` | Create: `name`, optional `description`, and either **`rules[]`** or **`sourceMappingAnalysisJobId`** (succeeded job with `outputProposal.rules`; do not send both). Writes an audit row `apihub.mapping_template.created`. |
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
| `POST` | `/api/apihub/ingestion-jobs/:jobId/apply` | Marks apply outcome for a **succeeded** run (409 conflict codes for not succeeded / already applied / blocked). **P3 downstream:** optional JSON `{ "target": "sales_order" \| "purchase_order" \| "control_tower_audit", "rows"?: [...], "matchKey"?: "none" \| "sales_order_external_ref" \| "purchase_order_buyer_reference", "writeMode"?: "create_only" \| "upsert" }` (same mapped-row shapes as staging; requires **`org.orders` → edit** for SO/PO and **`org.controltower` → edit** for CT audit). **`writeMode` `upsert`** updates an existing SO/PO matched by ref (see [apply-operator-runbook](./apply-operator-runbook.md)); invalid combinations return **400**. Rows default from `resultSummary` when the body omits `rows` but the summary has **`rows`** / **`applyRows`**. Live apply **claims** `appliedAt` then writes downstream in one transaction. **`matchKey`** ref modes with **`create_only`** reject duplicates; **`upsert`** updates instead. **`targetSummary`** counts **`updated`** vs **`created`** when downstream rows set **`applyOp`**. Marker-only apply (no `target`) only sets `appliedAt`. **`idempotency-key`:** fingerprint includes **`writeMode`**; **409** `APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH` if shape changes. |
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
