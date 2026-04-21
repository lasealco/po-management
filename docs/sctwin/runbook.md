# Supply Chain Twin Runbook (Stub)

Operator quick reference for local/demo validation of the Supply Chain Twin slice.

## Verify Command

- Run `npm run verify:sctwin` from the repo root.
- This checks TypeScript (`npx tsc --noEmit`) and runs twin-scoped Vitest suites.

## Seed Commands (Twin-Focused)

- Base demo tenant data:
  - `USE_DOTENV_LOCAL=1 npm run db:seed`
- Supply Chain Twin demo data:
  - `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-demo`

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

## Troubleshooting (Stub)

- If readiness reports missing tables, apply migrations on the target database:
  - `npm run db:migrate`
  - or `npx prisma migrate deploy`
- If APIs return 403 for demo checks, confirm session/user has Twin visibility and is not supplier-portal restricted.
- If data appears empty after seeding, confirm the app and seed commands are pointing at the same `DATABASE_URL`.
