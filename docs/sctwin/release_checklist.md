# Supply Chain Twin Release Checklist

Use this checklist for predictable Twin releases and handoffs. Keep commands secret-free and run from the repo root unless noted otherwise.

## 1) Pre-release checks

- Confirm scope is Twin-only (or explicitly approved cross-module touches).
- Confirm pending migrations are committed in `prisma/migrations/**` when schema changed.
- Run release gate:
  - `npm run verify:sctwin:full`
- If Twin docs changed, sanity-scan `docs/sctwin/**` for stale route/command references.

## 2) Data and migration readiness

- Apply database migrations for the target environment:
  - `npm run db:migrate` (local/dev style)
  - or `npx prisma migrate deploy` (deployed environment style)
- Validate readiness endpoint:
  - `GET /api/supply-chain-twin/readiness`
  - Expect stable JSON with `ok` and safe `reasons`.
- If demo/non-empty state is required, run seeds intentionally:
  - Base tenant data: `USE_DOTENV_LOCAL=1 npm run db:seed`
  - Twin demo data: `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-demo`
  - Optional large fixture: `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-large-fixture`

## 3) Release verification gates

- Use the canonical command map in `docs/sctwin/runbook.md` to avoid drift.
- Pre-release gate (recommended before merge): `npm run verify:sctwin:prerelease`
- Minimum release gate: `npm run verify:sctwin:full`
- Final program gate (milestone closeout): `npm run verify:sctwin:program`
- Optional runtime smoke: `npm run smoke:sctwin:e2e`

## 4) Smoke URLs and API probes

Use the canonical route map in `docs/sctwin/runbook.md` and keep smoke coverage to:

- UI flow: overview -> explorer -> scenarios.
- API flow: readiness -> entities -> edges -> events -> metrics.
- Optional: run the scripted smoke pack (`npm run smoke:sctwin:e2e`) for JSON summary output.

Expected: authenticated requests return stable JSON contracts, no raw stack traces, and no sensitive payload leakage in responses.

## 5) Rollback hints

Use the smallest safe rollback:

- If issue is UI-only and migration-safe: roll back app commit/deploy to prior known-good revision.
- If a new migration caused breakage:
  - Stop rollout.
  - Roll back app to a revision compatible with current schema.
  - Prepare and apply a forward-fix migration (preferred over destructive schema rollback).
- If seeded demo data caused confusion:
  - Re-run intended seed set for the target environment, or clean/reseed per environment policy.

Always capture:

- failing route(s),
- request correlation id (`x-request-id` / Twin request-id header when present),
- failing commit SHA,
- migration version applied.

## 6) Handoff template

Record these in release notes:

- Scope summary (what changed in Twin)
- Verification commands run and pass/fail
- Migration IDs applied (if any)
- Seed commands run (if any)
- Smoke URLs checked
- Known risks or follow-ups
