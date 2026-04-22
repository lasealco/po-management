# API hub — spec ↔ codebase gap map

**Legend:** ✅ shipped · 🟡 partial / stub · ❌ not started

**Last updated:** 2026-04-22 (connector health probe UI + audit actor on list/API). **Phase 1 (module MVP)** is **closed** for integration-hub scope — see [CLOSEOUT_AUDIT.md](./CLOSEOUT_AUDIT.md) §5; P2+ items (AI jobs, batch/staging tables, org RBAC) remain future.

| Area | Repo reality | Notes |
|------|--------------|--------|
| Tenant scoping (repos) | ✅ [`TENANT_SCOPING.md`](./TENANT_SCOPING.md), `*.tenant-scope.test.ts` | Mapping template PATCH/DELETE use `updateMany`/`deleteMany` with `{ id, tenantId }`; sample repo `where` assertions |
| Slice 60 handoff | ✅ [`CLOSEOUT_AUDIT.md`](./CLOSEOUT_AUDIT.md) | Inventory, verify commands, **residual risk log** (R1–R9), sign-off checklist |
| Docs home | ✅ `docs/apihub/README.md`, specs | README includes **mapping API** table + **apply-operator-runbook** (operator triage) |
| Docs runbook | ✅ `docs/apihub/RUNBOOK.md` | Docs-only workflow; points to README for live endpoint index |
| Permissions matrix (docs ↔ guards) | ✅ [`permissions-matrix.md`](./permissions-matrix.md), optional `src/lib/apihub/apihub-access-model.ts` | Public = `GET /api/apihub/health` only; all other API Hub routes + `/apihub` UI use demo tenant + demo actor; fine-grained RBAC deferred to Slice 52–53 |
| Ingestion spec | 🟡 `integrations-ai-assisted-ingestion.md` | Draft; phased table has footnote vs shipped deterministic mapping |
| App route `/apihub` | ✅ `src/app/apihub/**` | Connectors + **mapping templates** UI + **diff** + **preview export** + **Alerts** + **Apply conflicts**; demo session required |
| Health / discovery API | ✅ `GET /api/apihub/health` | `{ ok, service, phase }`; no secrets |
| Prisma: **connector registry** | ✅ `ApiHubConnector` + `ApiHubConnectorAuditLog`; `GET/POST /api/apihub/connectors`; `PATCH /api/apihub/connectors/:id`; `GET …/connectors/:id/health` + `GET …/audit` | List/SSR includes recent audit + actor identity; `/apihub` **Run live health probe**; no secrets / OAuth / workers |
| Prisma: **mapping templates** | ✅ `ApiHubMappingTemplate` + `ApiHubMappingTemplateAuditLog` | Full CRUD + list audit APIs; migrations `20260422160000_*`, `20260422170000_*` |
| Prisma: batch / staging tables | ❌ | Spec “batch + staging” tables still future (rules live on templates + preview payloads) |
| Mapping engine + preview | ✅ `src/lib/apihub/mapping-engine.ts`, `mapping-preview-run.ts` | `POST …/mapping-preview` + **export** (`json` \| `csv`); `sampleSize` cap |
| Rule diff API | ✅ `POST /api/apihub/mapping-diff` | Keyed by `targetField`; used from `/apihub` |
| AI analysis job pipeline | ❌ | P2+ (async job + LLM proposals not wired) |
| Deterministic **apply** API | 🟡 `POST /api/apihub/ingestion-jobs/:id/apply` (+ dry-run, idempotency, rollback stub, audit, conflicts **GET**, alerts **GET**, `/apihub` triage) | Operator runbook: `apply-operator-runbook.md`; downstream CT/PO/SO wiring still scenario-specific |

## Near-term build order

1. P0 — shell + health + docs links — **shipped**.
2. P1 — **connector registry** + **mapping templates** + ingestion/apply operator surfaces — **shipped**; **batch/staging** Prisma still future (see R5 in closeout).
3. P2 — async analysis job + richer editor; **preview / diff / export** already support operators today.
4. P3 — extend **apply** to production paths per scenario + idempotency hardening as needed.
5. P4 — conflicts, match keys, hardening.
