# API hub — spec ↔ codebase gap map

**Legend:** ✅ shipped · 🟡 partial / stub · ❌ not started

**Last updated:** 2026-04-22 — Permissions matrix reconciled to **27** `route.ts` handlers; **bounded JSON** bodies + [product-completion-v1.md](./product-completion-v1.md).

| Area | Repo reality | Notes |
|------|--------------|--------|
| Tenant scoping (repos) | ✅ [`TENANT_SCOPING.md`](./TENANT_SCOPING.md), `*.tenant-scope.test.ts` | Mapping template PATCH/DELETE use `updateMany`/`deleteMany` with `{ id, tenantId }`; sample repo `where` assertions |
| Slice 60 handoff | ✅ [`CLOSEOUT_AUDIT.md`](./CLOSEOUT_AUDIT.md) | Inventory, verify commands, **residual risk log** (R1–R9); some risks partially mitigated (see below) |
| Docs home | ✅ `docs/apihub/README.md`, specs | Route index includes mapping analysis, staging, apply, discard, playbook for catalog/tariffs |
| Docs runbook | ✅ `docs/apihub/RUNBOOK.md` | Docs-only workflow; points to README for live endpoint index |
| Permissions matrix | ✅ [`permissions-matrix.md`](./permissions-matrix.md) | **Slice 52:** `org.apihub` view/edit; staging apply cross-grants. **2026-04-22:** table matches **27** handlers under `src/app/api/apihub/**` (health + guarded routes). |
| JSON / abuse limits | ✅ [`product-completion-v1.md`](./product-completion-v1.md), `src/lib/apihub/request-body-limit.ts` | POST/PATCH bounded reads; **413** `PAYLOAD_TOO_LARGE` over cap (`APIHUB_JSON_BODY_MAX_BYTES*`). |
| Ingestion spec | 🟡 `integrations-ai-assisted-ingestion.md` | **Narrative draft** (principles, scenarios, phased roadmap); **implementation truth** = README + GAP_MAP + permissions matrix |
| App route `/apihub` | ✅ `src/app/apihub/**` | Analysis jobs, staging list + apply + discard, templates, connectors, ingestion triage |
| Health / discovery API | ✅ `GET /api/apihub/health` | `{ ok, service, phase }`; no secrets |
| Prisma: **connector registry** | ✅ `ApiHubConnector` + audit, CRUD + health + list | |
| Prisma: **mapping templates** | ✅ + audit, CRUD, diff | |
| Prisma: **staging** | ✅ `ApiHubStagingBatch`, `ApiHubStagingRow`; `appliedAt` / `applySummary` | Materialize from succeeded analysis job; apply downstream; discard open batches |
| Mapping engine + preview | ✅ | Export csv/json |
| AI analysis job pipeline | ✅ | Heuristic + optional OpenAI; `outputProposal.llm`; **Save rules as template** via `POST /mapping-templates` + `sourceMappingAnalysisJobId` |
| Deterministic **apply** (ingestion run) | 🟡 | Marks `appliedAt`; CT/PO/SO via dedicated adapters elsewhere |
| Staging **apply** (domain) | ✅ | SO/PO/CT audit from mapped rows; cross-grants `org.orders` / `org.controltower` |
| Background workers | 🟡 | Mapping jobs use `after()`; no dedicated queue consumer (see R2 closeout) |

## Residual (from closeout, condensed)

| ID | Status |
|----|--------|
| R1 Demo vs org RBAC | 🟡 **`org.apihub`** shipped; still demo tenant + actor for data scope |
| R2 Workers | 🟡 No queue ETL |
| R3 Ingestion apply → downstream | 🟡 Staging apply adds SO/PO/CT path; ingestion apply still marker-centric |
| R5 Batch/staging tables | ✅ Shipped |

## Near-term build order

1. P0–P1 — shell, connectors, templates, ingestion — **shipped**.
2. P2 — analysis jobs + staging + LLM + template-from-job — **shipped** (iterate on models/prompts).
3. P3 — ingestion apply to more production paths; **match keys**, conflict policy.
4. P4 — centralized abuse budgets, conformance tests, leakage audit pack.
