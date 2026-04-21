# API Hub docs runbook

This runbook defines the repeatable workflow for docs-only API Hub updates. Use it for issue-driven docs maintenance, spec updates, and gap map hygiene without touching app or Prisma code.

## Scope

- In scope: `docs/apihub/**` and `docs/engineering/agent-todos/integration-hub.md`.
- Out of scope for this runbook: `src/**`, `prisma/**`, migrations, or runtime behavior.
- Primary audience: maintainers handling API Hub documentation issues and PRs.

## Inputs before starting

1. Confirm issue scope (what changed in product direction, contract, or phase status).
2. Confirm current docs baseline:
   - `docs/apihub/README.md`
   - `docs/apihub/integrations-ai-assisted-ingestion.md`
   - `docs/apihub/GAP_MAP.md`
   - `docs/engineering/agent-todos/integration-hub.md`
3. Confirm target branch naming for the wave/session task and PR base (`origin/main` unless requested otherwise).

## Execution workflow

### 1) Update canonical spec content first

- Apply product/engineering decisions in `integrations-ai-assisted-ingestion.md`.
- Keep phased table and open decisions aligned with current delivery reality.
- Avoid speculative implementation details that are not approved.

### 2) Update docs home links and entry points

- Reflect new or renamed docs in `README.md`.
- Keep "In-app entry" notes factual (what exists today vs planned).
- Ensure GitHub links and relative links resolve.

### 3) Update gap map truth table

- Refresh `GAP_MAP.md`:
  - `Last updated` date.
  - Legend state per area (shipped/partial/not started).
  - Notes that clearly separate shipped behavior from stubs.
- Keep near-term build order consistent with the phased table in the spec.

### 4) Sync engineering todo cross-links

- Update `docs/engineering/agent-todos/integration-hub.md` when doc locations, scope notes, or phase checkpoints changed.
- Keep suggested allowed paths and phase language consistent with the docs set.

## Quality checks before PR

- Link check by inspection:
  - All relative markdown links resolve.
  - Any GitHub links point to the correct repo path.
- Consistency check:
  - README, full spec, and GAP_MAP do not contradict each other.
  - Phase labels (P0-P4) match across docs.
- **Mapping / ingestion API index:** when shipping or renaming **mapping preview**, **template**, **diff**, or **export** routes, update the **“Mapping contract (shipped)”** section in `README.md` and the gap rows in `GAP_MAP.md` in the same PR (or a fast-follow docs PR).

## Runtime + docs alignment (maintainers)

If code under `src/app/api/apihub/**` or `src/lib/apihub/**` changes public contracts, refresh `README.md` (endpoint table + body field notes) even when the issue is not “docs-only.” Slice 40 established that table as the operator-facing source of truth alongside `GAP_MAP.md`.
- Scope check:
  - Diff only includes allowed docs paths for docs-only issues.

## PR checklist (docs-only API Hub issue)

- Branch created from `origin/main` with requested naming.
- Commit message uses concise imperative wording and API Hub scope.
- PR body includes:
  - Summary of docs changes.
  - Explicit statement that no `src/**` or `prisma/**` files were modified.
  - Any follow-up work items still open.
- PR opened and left unmerged for review.

## Change log guidance

When a docs issue lands, add a short note in the touched doc sections that changed intent or status materially (for example, a date refresh in `GAP_MAP.md` and a short scope clarifier in `integration-hub.md`).
