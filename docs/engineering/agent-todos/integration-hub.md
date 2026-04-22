# Integration hub / API hub — agent todo list (greenfield)

**GitHub label:** `module:integration-hub`

## Live spec home (use this instead of one-off “product one-pager” todos)

- **Documentation home:** [`docs/apihub/README.md`](../../apihub/README.md) — ingestion / integration API hub overview, GitHub links, in-app entry.
- **Full draft spec:** [`docs/apihub/integrations-ai-assisted-ingestion.md`](../../apihub/integrations-ai-assisted-ingestion.md) — product + technical contract (supersedes informal one-pager requests; iterate here and in PRs).
- **Gap map:** [`docs/apihub/GAP_MAP.md`](../../apihub/GAP_MAP.md) — what is shipped vs stub vs not started.
- **Docs runbook:** [`docs/apihub/RUNBOOK.md`](../../apihub/RUNBOOK.md) — docs-only execution flow, scope guardrails, and PR checklist.
- **Permissions matrix (Slice 51):** [`docs/apihub/permissions-matrix.md`](../../apihub/permissions-matrix.md) — public vs demo tenant + actor; matches route handlers today.

**P0 (meeting batch):** docs polish + read-only **`/apihub`** shell + **`GET /api/apihub/health`** — no Prisma / migrations unless explicitly approved. **P1+:** connector registry, ingestion jobs, **mapping templates + preview + diff + export** (shipped in repo; see README mapping table), async AI job pipeline still future — see spec phased delivery §8 and `GAP_MAP.md`.

**Suggested allowed paths (P0 PRs):** `docs/apihub/**`, `docs/engineering/agent-todos/integration-hub.md`, `src/app/apihub/**`, `src/app/api/apihub/**`, optional tiny `src/lib/apihub/**`

---

## Phase 0 — skeleton (safe, no backend contract yet)

- [x] **Product / technical spec** — [`docs/apihub/integrations-ai-assisted-ingestion.md`](../../apihub/integrations-ai-assisted-ingestion.md) (v1 draft; iterate in PRs).
- [x] **Route shell** — `/apihub` landing + step placeholders — GitHub [#16](https://github.com/lasealco/po-management/issues/16) (meeting batch P0).
- [x] **Health API** — `GET /api/apihub/health` stub (same issue).
- [x] **Nav / command palette** — command palette entry → `/apihub` for signed-in demo users (minimal; see #16).

---

## Phase 1 — contracts (after P0)

- [x] **Connector registry** — `ApiHubConnector` + migration `20260420183000_apihub_connector_registry`; `GET`/`POST` `src/app/api/apihub/connectors/route.ts`; Connectors section on `/apihub` (Session 8 / Phase 1 stub).
- [x] **Mapping templates + audit + diff + preview export** — Prisma `ApiHubMappingTemplate` (+ audit log), REST routes under `/api/apihub/mapping-templates/**`, `POST /api/apihub/mapping-diff`, preview + export under ingestion jobs; `/apihub` UI panels (2026-04 agent slices).
- [x] **Health / last sync** — list shows registry `lastSyncAt` + stored `healthSummary`; **Run live health probe** calls `GET …/connectors/:id/health` (readiness + checked-at; no secrets).
- [x] **Audit log slice** — `ApiHubConnectorAuditLog` + paginated `GET …/audit`; timeline and list preview resolve **actor name + email** (demo user).

---

## Hygiene

- [x] Keep [`docs/apihub/GAP_MAP.md`](../../apihub/GAP_MAP.md) and [`docs/apihub/README.md`](../../apihub/README.md) mapping section current when merging API hub PRs (last doc sync 2026-04-22 — connector health UI + audit actor).

---

## Phase 1 module MVP — closed (Slice 60)

Phase 0–1 items above are **complete** for the greenfield integration hub contract (demo tenant + actor, deterministic mapping/apply, operator UI). **Formal handoff:** [`docs/apihub/CLOSEOUT_AUDIT.md`](../../apihub/CLOSEOUT_AUDIT.md) (residual risks R1–R9, smoke checklist).

## Phase 2+ backlog (not Phase 1 scope)

Track in [`docs/apihub/GAP_MAP.md`](../../apihub/GAP_MAP.md) and product issues:

- Async **AI-assisted mapping** job pipeline (spec: [`integrations-ai-assisted-ingestion.md`](../../apihub/integrations-ai-assisted-ingestion.md)).
- **Batch / staging** Prisma tables when batch UX ships.
- Org-scoped **RBAC** for API + UI (Slices 52–53); workers/queues (R2); production **apply** adapters (R3); conformance / abuse / leakage hardening (R7–R9).
