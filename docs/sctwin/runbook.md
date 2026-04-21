# Supply Chain Twin Runbook (Stub)

Operator quick reference for local/demo validation of the Supply Chain Twin slice.

Release handoff companion: `docs/sctwin/release_checklist.md`.

## Verify Commands

- Run `npm run verify:sctwin` from the repo root.
- This checks TypeScript (`npx tsc --noEmit`) and runs twin-scoped Vitest suites.
- Run `npm run verify:sctwin:full` for release-gate validation on slices 88-107 (verify + contract tests).

## Seed Commands (Twin-Focused)

- Base demo tenant data:
  - `USE_DOTENV_LOCAL=1 npm run db:seed`
- Supply Chain Twin demo data:
  - `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-demo`
- Optional large-tenant Twin perf fixture (opt-in, 1k+ entities):
  - `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-large-fixture`
- Post-seed fast validation checklist:
  - `docs/sctwin/large_fixture_validation_checklist.md`

### Seed Determinism Notes (Slice 219)

- Re-running `db:seed:supply-chain-twin-demo` is idempotent:
  - Same demo entity/risk/event/scenario rows are upserted (no duplicates).
  - Compare scenario IDs stay stable for `/supply-chain-twin/scenarios/compare`.
- Re-running `db:seed:supply-chain-twin-large-fixture` is deterministic:
  - Fixture entities/risks/events are upserted by tenant-safe keys.
  - Fixture edges are replaced by relation prefix cleanup (`perf_fixture/*`) before insert.
  - Fixture scenarios are replaced by deterministic title-scope cleanup before re-upsert.
- Tenant safety guardrails:
  - Both Twin seed scripts now fail fast if a fixed scenario ID already exists under a different tenant.
  - This prevents cross-tenant mutation when re-running seeds on shared databases.

## Key Routes

- Twin overview page: `/supply-chain-twin`
- Explorer page: `/supply-chain-twin/explorer`
- Scenarios workspace: `/supply-chain-twin/scenarios`
- Readiness API: `/api/supply-chain-twin/readiness`
- Entities API: `/api/supply-chain-twin/entities`
- Edges API: `/api/supply-chain-twin/edges`
- Events API: `/api/supply-chain-twin/events`
- Metrics API: `/api/supply-chain-twin/metrics`

## Logging Pointers

- Twin API routes use structured logging helpers under `src/app/api/supply-chain-twin/_lib/sctwin-api-log.ts`.
- Use a request correlation header (`x-request-id`) when debugging multi-call flows.
- Review terminal/server output for `sctwinApi` log entries and matching `requestId`.

## Stable Error Codes (Developer Triage)

- Shared registry and parsers live in `src/lib/supply-chain-twin/error-codes.ts`.
- Use `parseTwinApiErrorCode(body)` when you only need the validated `code`.
- Use `parseTwinApiErrorBody(body)` when you need both `code` and fallback `error` message.
- For export UI copy, use `getTwinEventsExportErrorMessage(body)` instead of per-component string matching.
- Export filter precedence matches API behavior: when both `type` and legacy `eventType` are present, `type` wins.

## Troubleshooting Matrix

| Symptom | Checks | Fixes |
| --- | --- | --- |
| Twin APIs return `403` (`MODULE_DISABLED`, access denied, or supplier-portal restriction) | 1) Confirm logged-in user/session is valid and not supplier-portal restricted. 2) Check Twin feature flags used by API gate (`SCTWIN_FORCE_DISABLE`, `SCTWIN_DISABLED_TENANT_SLUGS`). 3) Verify tenant should have Twin access. | 1) Sign in with a permitted demo/internal user. 2) Remove/adjust disable flags for the target tenant. 3) Re-test with `curl -i /api/supply-chain-twin/readiness` and confirm `200`. |
| Twin pages load but datasets are empty (`items: []`) | 1) Hit `/api/supply-chain-twin/readiness` and confirm `ok` / data presence indicators. 2) Verify seed commands ran against the same database as the app runtime. 3) Check list filters/cursors (`q`, `entityKind`, `since/until`, `severity`, `cursor`) are not over-restrictive. | 1) Run baseline + twin seed commands again: `USE_DOTENV_LOCAL=1 npm run db:seed` then `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-demo`. 2) For pagination/perf demos, add `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-large-fixture`. 3) Clear URL filters and retest from first page. |
| Queries feel slow on explorer/scenarios/events | 1) Confirm indexes/migrations are applied (`npm run db:migrate` or `npx prisma migrate deploy`). 2) Prefer summary/lightweight modes (`fields=summary`, `includePayload=false`). 3) Check request scope (window size and limits) against request-budget caps. | 1) Apply latest migrations. 2) Narrow windows (`since/until`) and use smaller `limit`. 3) Use server-driven cursor pagination instead of broad first-page loads. |
| Events export returns row-cap validation error | 1) Review export query params and current filters (`type`, `since`, `until`, `includePayload`). 2) Confirm result size likely exceeds export cap. | 1) Narrow time window and/or add `type` filter. 2) Export in smaller slices (e.g., per day/hour). 3) Retry once filters are constrained. |
| Readiness reports schema/table issues | 1) Check readiness API body for non-sensitive failure reasons. 2) Verify Prisma schema + migration state for the target DB. | 1) Run `npm run db:migrate` locally, or `npx prisma migrate deploy` for deployed environments. 2) Re-check `/api/supply-chain-twin/readiness` after migrate. |

## Performance Notes (Query Plan + Index Intent)

Twin hot-path indexes are documented in these migrations:

- `prisma/migrations/20260428120000_supply_chain_twin_list_hot_path_indexes/migration.sql`
- `prisma/migrations/20260428142000_supply_chain_twin_ingest_time_type_index/migration.sql`
- `prisma/migrations/20260428172000_supply_chain_twin_scenario_history_index_tuning/migration.sql`
- `prisma/migrations/20260428190000_supply_chain_twin_final_index_tuning/migration.sql`

Quick mapping (query shape -> index family):

- Entity catalog keyset list (`tenantId`, `updatedAt desc`, `id desc`) -> `SupplyChainTwinEntitySnapshot(tenantId, updatedAt[, id])`
- Edge lists/neighbors (`tenantId`, snapshot filters, `updatedAt desc`, `id desc`) -> `SupplyChainTwinEntityEdge(tenantId, [from|to]SnapshotId, updatedAt, id)` and `(...tenantId, updatedAt, id)`
- Event timeline/export (`tenantId`, optional `type`, optional `createdAt` window, `createdAt desc`, `id desc`) -> `SupplyChainTwinIngestEvent(tenantId, createdAt, id)` and `(tenantId, type, createdAt, id)`
- Risk signal list (`tenantId`, optional `severity`, `createdAt desc`, `id desc`) -> `SupplyChainTwinRiskSignal(tenantId, createdAt[, id])` and `(tenantId, severity, createdAt, id)`
- Scenario history (`tenantId`, `scenarioDraftId`, `createdAt desc`, `id desc`) -> `SupplyChainTwinScenarioRevision(tenantId, scenarioDraftId, createdAt, id)`

When to revisit/add indexes:

- P95/P99 latency for Twin list endpoints regresses after release or dataset growth.
- `EXPLAIN (ANALYZE, BUFFERS)` shows sequential scans on Twin tables for tenant-scoped list routes.
- A new filter/sort pattern appears in Twin APIs that is not left-prefix-compatible with current composites.
- Large fixture runs (`db:seed:supply-chain-twin-large-fixture`) show unstable pagination latency at higher pages.

## Triage Sequence (Fast Path)

1. Run `npm run verify:sctwin:full` (or `npm run verify:sctwin` for faster local iteration).
2. Check `/api/supply-chain-twin/readiness`.
3. Validate access/entitlement (`403` causes) before deeper debugging.
4. Re-seed demo data if the environment is expected to be non-empty.
5. Re-run targeted API calls with narrow filters and cursor reset.
