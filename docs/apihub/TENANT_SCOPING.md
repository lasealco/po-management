# API Hub — tenant scoping (Slice 61)

All **API Hub** persistence entry points are intended to be **tenant-scoped**: reads and writes must not return or mutate another tenant’s rows when `tenantId` is supplied correctly from the session / route layer.

## Route layer

`src/app/api/apihub/**` resolves the active tenant (today: **`getDemoTenant()`** demo tenant) and passes **`tenant.id`** into repository functions. Do not call repos with a client-supplied tenant id.

## Repository modules (`src/lib/apihub/**`)

| Module | Scoping notes |
|--------|----------------|
| `connectors-repo.ts` | `listApiHubConnectors`, `getApiHubConnectorInTenant`, `getApiHubConnectorHealthContext`, audit lists, lifecycle updates — `where` includes `tenantId` (and `connectorId` where relevant); **lifecycle field mutations** use `updateMany` **`{ id, tenantId }`** then re-read. |
| `ingestion-runs-repo.ts` | List, get, create, transition, retry, count, `groupBy` — all filter `tenantId`. |
| `ingestion-apply-repo.ts` | `applyApiHubIngestionRun` uses `tenantId` on `findFirst` / `updateMany`. |
| `ingestion-apply-idempotency-repo.ts` | Composite unique `tenantId` + `idempotencyKey`. |
| `ingestion-apply-conflicts-repo.ts` | Raw SQL `WHERE "tenantId" = $…`. |
| `ingestion-alerts-summary-repo.ts` | Raw SQL `WHERE "tenantId" = $…`. |
| `ingestion-run-audit-repo.ts` | `create` includes `tenantId` from caller. |
| `ingestion-run-timeline-repo.ts` | All `findFirst` / `findMany` include `tenantId`. |
| `mapping-templates-repo.ts` | List/get scoped; **updates and deletes** use `updateMany` / `deleteMany` with **`{ id, tenantId }`** so mutations are atomic with tenant in the `WHERE` clause (Slice 61 hardening). |
| `staging-batches-repo.ts` | List/get/discard/create-from-job — `where` includes `tenantId` (and ids); **discard** uses `updateMany` with **`{ id, tenantId }`**. |

## Automated checks

Vitest files assert representative `where` shapes for:

- `mapping-templates-repo.tenant-scope.test.ts`
- `staging-batches-repo.tenant-scope.test.ts`
- `ingestion-runs-repo.tenant-scope.test.ts`
- `connectors-repo.tenant-scope.test.ts`
- `connectors-repo.lifecycle-tenant-scope.test.ts`
- Raw SQL list endpoints: `ingestion-apply-conflicts-repo.test.ts` and `ingestion-alerts-summary-repo.test.ts` assert **`tenantId`** is bound in `Prisma.sql` **`values`**.
- Timeline page: `ingestion-run-timeline-repo.tenant-scope.test.ts` (**anchor**, **parent walk**, **BFS**, **row fetch**).
- Mapping analysis jobs: `mapping-analysis-jobs-repo.tenant-scope.test.ts` (**get** / **list** / **create** `tenantId`).

Run: `npm run test:apihub`

## Follow-ups

- **`mapping-analysis-job-claim.ts`** uses `$queryRaw` for worker claims; locking semantics live in **`mapping-analysis-job-claim.test.ts`** (not a tenant-string snapshot test).
- Enterprise tranche **Slice 61** in `agent_milestones_one_agent.md` is satisfied for **defense-in-depth mutations** + **contract tests**; exhaustive review of every SQL fragment is still optional.

**Last updated:** 2026-04-22
