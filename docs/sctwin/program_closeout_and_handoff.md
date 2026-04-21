# Supply Chain Twin — Program Closeout and Handoff (Slices 1–240)

This document is the **handoff anchor** for the milestone sequence in `docs/sctwin/agent_milestones_one_agent.md` (Slices **1–240**).

It is intentionally **environment-secret-free**. For live URLs, credentials, and Neon notes, follow `docs/database-neon.md` and local `.env` / `.env.local` policy.

## What this milestone delivered (high-signal)

The milestone sequence shipped a **tenant-scoped Twin vertical slice** with stable contracts, operator docs, and automated gates:

- **Readiness + access model**: `GET /api/supply-chain-twin/readiness` and UI callouts when the module is not ready or access is denied.
- **Catalog + graph primitives**: entities, edges, entity detail, neighbors, metrics strip, and explorer flows under `/supply-chain-twin/**`.
- **Events + exports**: list/query endpoints, export path, caps/guardrails, and UI export affordances where applicable.
- **Scenarios**: draft lifecycle (create/patch/delete/duplicate), compare surface, and history timeline backed by repository + API routes.
- **Risk signals**: listing + acknowledgement semantics with stable validation and error codes.
- **Ingestion + integrity**: append/idempotency patterns, integrity checks, and repair dry-run/apply admin endpoints (maintenance).
- **Release engineering**: Twin-scoped Vitest + contract suites, ESLint gate, program gate runner, scripted smoke pack, contract snapshot baseline, and RC observation notes.

Authoritative backlog and sequencing beyond this milestone lives in `docs/sctwin/supply_chain_twin_sprint_backlog_and_release_plan.md`.

## Closeout checklist (operator / release owner)

Use this as the minimum “we can hand off deploy artifacts + runbooks” checklist:

1. **Scope sanity**
   - Confirm the change set is Twin-scoped (or explicitly approved cross-module touches).
2. **Migrations**
   - If schema changed: migrations are committed under `prisma/migrations/**` and applied in the target environment (`npm run db:migrate` locally, `npx prisma migrate deploy` in deployed style).
3. **Automated gates**
   - Pre-merge (recommended): `npm run verify:sctwin:prerelease`
   - Release gate: `npm run verify:sctwin:full`
   - Program closeout gate: `npm run verify:sctwin:program`
4. **Seeds (only if the environment must be non-empty)**
   - Base tenant: `USE_DOTENV_LOCAL=1 npm run db:seed`
   - Twin demo: `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-demo`
   - Optional perf fixture: `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-large-fixture`
5. **Runtime smoke (optional but valuable)**
   - Scripted pack: `npm run smoke:sctwin:e2e`
   - Requires a reachable `BASE_URL` (see `docs/sctwin/release_candidate_dry_run_2026-04-21.md` for the “no server running” failure mode and improved `BASE_URL_UNREACHABLE` diagnostics).
6. **Human verification**
   - Walk UI: overview → explorer → scenarios (incl. compare when relevant).
   - Probe APIs using the canonical route map in `docs/sctwin/runbook.md`.

## Linked artifacts (single navigation hub)

- **Milestone slices (agent source of truth):** `docs/sctwin/agent_milestones_one_agent.md`
- **Operator commands + routes (canonical maps):** `docs/sctwin/runbook.md`
- **Release checklist:** `docs/sctwin/release_checklist.md`
- **Governance / maintenance:** `docs/sctwin/governance_runbook.md`
- **RC observation log:** `docs/sctwin/release_candidate_dry_run_2026-04-21.md`
- **Residual risks:** `docs/sctwin/final_risk_register.md`
- **Program closeout gate (templates):** `docs/sctwin/program_closeout_gate.md`
- **API contract snapshot (shapes):** `docs/sctwin/api_contract_snapshot.md`
- **Frozen v1 reference:** `docs/sctwin/api-contract-v1.md`
- **Versioned baseline + review flow:** `docs/sctwin/contract_snapshot_baseline.md`

## Handoff note template (copy into release notes)

```md
## Supply Chain Twin — Program handoff (Slices 1–240)

- Date:
- Owner:
- Commit SHA:
- Environment:

### Gates
- `npm run verify:sctwin:prerelease`: PASS/FAIL
- `npm run verify:sctwin:full`: PASS/FAIL
- `npm run verify:sctwin:program`: PASS/FAIL

### DB
- Migrations applied (ids):
- Seeds run (commands):

### Smoke
- Manual UI/API probes (see runbook route map):
- `npm run smoke:sctwin:e2e`: PASS/FAIL/SKIPPED (reason)

### Risks / follow-ups
- See `docs/sctwin/final_risk_register.md` for accepted/deferred items.
```
