# API hub — spec ↔ codebase gap map

**Legend:** ✅ shipped · 🟡 partial / stub · ❌ not started

**Last updated:** 2026-04-22 — **P3** ingestion apply match keys; **P4** `request-budget` tiers + route conformance + stable `apiHubError` envelope test; bounded JSON + [product-completion-v1.md](./product-completion-v1.md).

| Area | Repo reality | Notes |
|------|--------------|--------|
| Tenant scoping (repos) | ✅ [`TENANT_SCOPING.md`](./TENANT_SCOPING.md), `*.tenant-scope.test.ts` | Mapping template PATCH/DELETE use `updateMany`/`deleteMany` with `{ id, tenantId }`; sample repo `where` assertions |
| Slice 60 handoff | ✅ [`CLOSEOUT_AUDIT.md`](./CLOSEOUT_AUDIT.md) | Inventory, verify commands, **residual risk log** (R1–R9); some risks partially mitigated (see below) |
| Docs home | ✅ `docs/apihub/README.md`, specs | Route index includes mapping analysis, staging, apply, discard, playbook for catalog/tariffs |
| Docs runbook | ✅ `docs/apihub/RUNBOOK.md` | Docs-only workflow; points to README for live endpoint index |
| Permissions matrix | ✅ [`permissions-matrix.md`](./permissions-matrix.md) | **Slice 52:** `org.apihub` view/edit; staging apply cross-grants. **2026-04-22:** table matches **27** handlers under `src/app/api/apihub/**` (health + guarded routes). |
| JSON / abuse limits (P4) | ✅ [`product-completion-v1.md`](./product-completion-v1.md), `request-body-limit.ts`, **`request-budget.ts`**, **`safe-server-log.ts`**, conformance tests | POST/PATCH bounded reads; **413** over cap; tier helpers; no-body POSTs still call `parseApiHubPostJsonForRouteWithBudget` (empty body ok); background errors via **`logApiHubBackgroundError`**. |
| Ingestion spec | 🟡 `integrations-ai-assisted-ingestion.md` | **Narrative draft** (principles, scenarios, phased roadmap); **implementation truth** = README + GAP_MAP + permissions matrix |
| App route `/apihub` | ✅ `src/app/apihub/**` | Analysis jobs, staging list + apply + discard, templates, connectors, ingestion triage. **Slice 2 (2026-04-22):** client fetch failures that return JSON include **Advanced** error body where applicable (ops, alerts, conflicts, run expand + timeline, connector audit, rules diff, staging apply). |
| Health / discovery API | ✅ `GET /api/apihub/health` | `{ ok, service, phase }`; no secrets |
| Prisma: **connector registry** | ✅ `ApiHubConnector` + audit, CRUD + health + list | |
| Prisma: **mapping templates** | ✅ + audit, CRUD, diff | |
| Prisma: **staging** | ✅ `ApiHubStagingBatch`, `ApiHubStagingRow`; `appliedAt` / `applySummary` | Materialize from succeeded analysis job; apply downstream; discard open batches |
| Mapping engine + preview | ✅ | Export csv/json |
| AI analysis job pipeline | ✅ | Heuristic + optional OpenAI; `outputProposal.llm`; **Save rules as template** via `POST /mapping-templates` + `sourceMappingAnalysisJobId` |
| Deterministic **apply** (ingestion run) | ✅ | **P3:** optional `target` + rows; `matchKey` + **`writeMode`** (`create_only` / **`upsert`**) for ref keys; SO/PO/CT writers; `targetSummary.updated` when upsert; 409 `APPLY_DOWNSTREAM_FAILED` on failure |
| Staging **apply** (domain) | ✅ | SO/PO/CT audit from mapped rows; cross-grants `org.orders` / `org.controltower` |
| Background workers | 🟡 | Mapping jobs use `after()`; no dedicated queue consumer (see R2 closeout) |

## Residual (from closeout, condensed)

| ID | Status |
|----|--------|
| R1 Demo vs org RBAC | 🟡 **`org.apihub`** shipped; still demo tenant + actor for data scope |
| R2 Workers | 🟡 No queue ETL |
| R3 Ingestion apply → downstream | 🟡 Staging + ingestion **live apply** share row writers; full “upsert / merge” policy still TBD (P4) |
| R5 Batch/staging tables | ✅ Shipped |

## Near-term build order

1. P0–P1 — shell, connectors, templates, ingestion — **shipped**.
2. P2 — analysis jobs + staging + LLM + template-from-job — **shipped** (iterate on models/prompts).
3. P3 — ingestion apply to SO/PO/CT (**shipped**); ref **`matchKey`** + ingestion-only **`writeMode` `upsert`** (SO header fields + PO single-line replace); staging remains create-only.
4. P4 — **shipped (2026-04-22):** centralized JSON body tiers (`request-budget.ts`); every POST/PATCH route uses `*WithBudget` helpers (including no-body POSTs that still bounded-read); route conformance tests (`apihub-routes-conformance.test.ts`); stable `apiHubError` / `apiHubValidationError` envelope tests (`api-error.test.ts`); **`safe-server-log`** + **leakage conformance** (`apihub-leakage-conformance.test.ts`).
