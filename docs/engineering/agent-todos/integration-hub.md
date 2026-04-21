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
- [ ] **Health / last sync** — display-only fields on registry rows (mock data ok until integrations exist).
- [ ] **Audit log slice** — who changed connector config (may reuse existing audit patterns).

---

## Hygiene

- [x] Keep [`docs/apihub/GAP_MAP.md`](../../apihub/GAP_MAP.md) and [`docs/apihub/README.md`](../../apihub/README.md) mapping section current when merging API hub PRs (last doc sync 2026-04-22).
