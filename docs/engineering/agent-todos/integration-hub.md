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

## Phase 2+ backlog (post–P2 heuristic)

Track in [`docs/apihub/GAP_MAP.md`](../../apihub/GAP_MAP.md) and product issues:

- [x] **Async mapping analysis job** — `ApiHubMappingAnalysisJob`, list/create/detail/process routes, `/apihub` panel, `after()` processing, **stagingPreview** on success; optional **LLM** JSON when API keys set.
- [x] **Batch / staging** — `ApiHubStagingBatch` / `ApiHubStagingRow`, materialize, apply (SO/PO/CT), discard; **`org.apihub`** + cross-grants on apply.
- [x] **Template from analysis job** — `POST /mapping-templates` with **`sourceMappingAnalysisJobId`**; UI **Save rules as template**.
- [x] **Stale mapping-analysis reclaim** — cron sweep resets `processing` jobs older than configurable threshold before draining `queued` (R2 partial; **2026-04-22**).
- [x] **Stale ingestion-run reclaim** — same cron fails `running` runs past **`APIHUB_INGESTION_RUN_STALE_RUNNING_MS`** (default 24h, cap 7d) with **`STALE_RUNNING`**; `/apihub` run expand explains reclaim + retry API (R2 partial).
- [x] **Ingestion retry from workspace** — `/apihub/workspace` expanded run: **Retry run** (`org.apihub` edit) calls **`POST …/ingestion-jobs/:id/retry`**, refreshes list, expands new run.
- [x] **Smoke pack** — `scripts/apihub-smoke-pack.mjs` checks `/apihub/workspace` and aligns `/apihub` HTML assertions with **Guided import** + **ApihubGate** (no-cookie vs signed-in).
- [x] Workers/queues (R2 partial **2026-04-22**): Postgres **`FOR UPDATE SKIP LOCKED`** claim, optional parallel drain (**`APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL`**), optional **Upstash Redis** cron lock for mapping sweep; ingestion apply → **richer PO/SO header** fields (R3); smoke **cron unauthenticated** step.
- [x] Conformance / leakage guards (R7–R9 partial **2026-04-22**): route **surface count** + budget/`request.json` bans; leakage tests include **ApiHub cron** sweep route; **`DATABASE_URL` / `CRON_SECRET`** forbidden in `apihub/**/route.ts`; [`CLOSEOUT_AUDIT.md`](../../apihub/CLOSEOUT_AUDIT.md) residual rows kept in sync with shipped cron, staging, optional LLM (not only P4).
- [ ] Non–demo-tenant **live** E2E if required (repos already tenant-scoped in tests). **R9 partial (2026-04-22):** public health JSON contract tests; full OpenAPI for all routes still optional.
