# Supply Chain Twin — one-agent milestones (1–2 h slices)

Use this doc as the **single source of truth** for Cursor/Codex agents: paste or `@`-reference this file, then say **which slice number** to implement (**Slices 1–47**).

**Rules for the agent**

- Implement **one slice at a time** unless the user explicitly asks for more.
- **Merge or hand off** before starting the next slice if the user is doing parallel cosmetics (avoid touching the same files).
- Default **charter**: only edit paths listed under that slice; do not expand into unrelated modules (SRM, CRM-only refactors, etc.).
- Ship: `npx tsc --noEmit`, migrations committed if any, no secrets in git.
- **Slices 1–7** may already be implemented on `main` — before starting a slice, skim the tree (or git log) to avoid duplicating work.

**Cosmetics freeze (parallel with twin agent)**

While another workstream owns **global chrome / nav / product-trace UX**, the twin agent **must not** edit these paths **unless that slice explicitly lists an exception**:

- `src/components/app-nav.tsx`
- `src/components/brand-mark.tsx`
- `src/components/root-chrome.tsx`
- `src/app/layout.tsx` (root shell + `commandGrants`)
- `src/lib/nav-visibility.ts`
- `src/components/layout-po-subnav.tsx`
- `src/components/po-mgmt-subnav.tsx`
- `src/components/control-tower-subnav.tsx`
- `src/components/sales-orders-subnav.tsx`
- `src/app/sales-orders/layout.tsx`
- `src/components/command-palette.tsx`
- `src/components/help-assistant.tsx`
- `src/app/platform/page.tsx`
- `src/app/globals.css`
- `src/app/control-tower/search/search-client.tsx`

**Twin-default allowed zones:** `docs/sctwin/**`, `src/lib/supply-chain-twin/**`, `src/app/api/supply-chain-twin/**`, `src/app/supply-chain-twin/**`, `src/components/supply-chain-twin/**`, and `prisma/**` / `package.json` / `vitest.config.ts` **only when a slice says so**.

**Already shipped (baseline)**

- Preview route `/supply-chain-twin`, platform tile + top nav (**Twin**), command palette, help context.
- Visibility flag `supplyChainTwin` on `AppNavLinkVisibility` (derived from existing grants; no `org.sctwin` yet).

---

## Slice 1 — Readiness (~1–1.5 h)

**Goal:** Environment and permissions story before real twin data.

**Milestones**

- [ ] `GET /api/supply-chain-twin/readiness` — JSON `{ ok: boolean, reasons: string[] }` (start with `ok: true` or derive from DB later).
- [ ] Inline callout on `/supply-chain-twin` when `ok === false` (link to `docs/sctwin` or support).
- [ ] Optional: mirror invoice-audit readiness test style if the repo has one.

**Paths (typical):** `src/app/api/supply-chain-twin/readiness/`, `src/app/supply-chain-twin/page.tsx`, `src/lib/supply-chain-twin/readiness.ts` (if extracted).

**Done when:** Page loads without error; API returns stable JSON; cosmetics-friendly (small UI block only).

---

## Slice 2 — Domain skeleton (~1–1.5 h)

**Goal:** One library home for types and constants; no Prisma.

**Milestones**

- [ ] `src/lib/supply-chain-twin/` with `types.ts` (e.g. `TwinEntityKind`, `TwinEntityRef`, `TwinEdge` minimal).
- [ ] `constants.ts` — route prefix, module slug string.
- [ ] Short `README.md` in that folder: scope, non-goals, pointer to `docs/sctwin/README.md`.

**Paths:** under `src/lib/supply-chain-twin/**` only.

**Done when:** App routes can import from `@/lib/supply-chain-twin/...` with no circular deps.

---

## Slice 3 — Stub catalog API (~1.5–2 h)

**Goal:** First authenticated API + empty-state UI wired.

**Milestones**

- [ ] `GET /api/supply-chain-twin/entities?q=` — `{ items: [] }`, zod-validated query.
- [ ] Same auth/tenant pattern as an existing small API route.
- [ ] Client section on `/supply-chain-twin` (or subpage) that fetches and shows empty state.

**Paths (typical):** `src/app/api/supply-chain-twin/entities/`, `src/lib/supply-chain-twin/*`, small addition to `src/app/supply-chain-twin/`.

**Done when:** 200 + JSON in Network tab; 401/403 consistent with app for unauthenticated users.

---

## Slice 4 — Prisma persistence (~2 h)

**Goal:** Minimal table(s) aligned with upcoming graph spec.

**Milestones**

- [ ] Prisma model + migration (one table to start, e.g. tenant-scoped entity snapshot with JSON payload).
- [ ] `repo.ts` — `listForTenant(tenantId, …)`.
- [ ] Wire Slice 3 API to DB (may still return few rows).

**Paths:** `prisma/schema.prisma`, `prisma/migrations/**`, `src/lib/supply-chain-twin/**`, API route.

**Done when:** `db:migrate` applied; no Prisma runtime errors on the route.

---

## Slice 5 — Demo seed (~1 h)

**Goal:** Investor-visible non-empty list.

**Milestones**

- [ ] Script `npm run db:seed:supply-chain-twin-demo` (or guarded block in existing seed).
- [ ] One demo row for demo tenant.
- [ ] API returns ≥1 item; UI lists it.

**Paths:** `package.json` script, `prisma/*seed*`, `src/lib/supply-chain-twin/**`.

**Done when:** Document one command in this file’s footer or in `docs/database-neon.md` (one line).

---

## Slice 6 — Explorer route (~1.5–2 h)

**Goal:** Second PRD surface as structure (Twin explorer).

**Milestones**

- [ ] `GET` (or app route) `/supply-chain-twin/explorer` with layout shell.
- [ ] Table or cards bound to entities API; filters stubbed.
- [ ] In-page nav: Overview ↔ Explorer (links).

**Paths:** `src/app/supply-chain-twin/explorer/**`, optional small shared components under `src/components/supply-chain-twin/**`.

**Done when:** Deep-link works; no broken chrome.

---

## Slice 7 — Guardrails (~1 h)

**Goal:** Safe iteration post-demo.

**Milestones**

- [ ] Structured logging on API errors (no PII).
- [ ] Optional: update `docs/sctwin/supply_chain_twin_sprint_backlog_and_release_plan.md` with “M1–M7” status line.

**Paths:** API routes + tiny doc edit.

---

## Slice 8 — Twin UI: readiness wired (~1–1.5 h)

**Goal:** `/supply-chain-twin` reflects live `GET /api/supply-chain-twin/readiness` (no global nav edits).

**Milestones**

- [ ] Client island or RSC fetch on the twin preview page; loading + generic error UI.
- [ ] No query / tenant names in client error text.

**Paths:** `src/app/supply-chain-twin/**`, `src/components/supply-chain-twin/**` only.

---

## Slice 9 — Entities API: pagination contract (~1–1.5 h)

**Goal:** `limit` + `cursor` (or capped `offset`) with stable JSON; existing clients still work.

**Milestones**

- [ ] Zod for query params; cap `limit` (e.g. ≤100).
- [ ] Response `{ items, nextCursor? }` **or** document deferral in code comment + test for current shape.

**Paths:** `src/app/api/supply-chain-twin/entities/**`, `src/lib/supply-chain-twin/**`, colocated `*.test.ts`.

---

## Slice 10 — Prisma: graph edge table (~2 h)

**Goal:** Directed edges between twin entities (minimal columns, tenant-scoped).

**Milestones**

- [ ] New model + migration; FK to tenant / entity rows per your slice-4 model.
- [ ] Migration committed; local `prisma generate` implied for devs.

**Paths:** `prisma/schema.prisma`, `prisma/migrations/**` only (plus one-line note in `docs/sctwin/` if policy requires).

---

## Slice 11 — Repo: list edges (~1–1.5 h)

**Goal:** `listEdgesForTenant` (+ optional `listEdgesForEntity`) with tests.

**Milestones**

- [ ] Read-only queries; empty list when no rows.
- [ ] Tests follow existing Prisma test style in repo.

**Paths:** `src/lib/supply-chain-twin/**` + tests under same tree.

---

## Slice 12 — API: `GET /api/supply-chain-twin/edges` (~1.5 h)

**Goal:** Authenticated edges list mirroring entities route auth + logging.

**Milestones**

- [ ] Route + colocated Vitest; structured `logSctwinApiError` / warn on validation.

**Paths:** `src/app/api/supply-chain-twin/edges/**` only (+ tests).

---

## Slice 13 — Types: graph + provenance (~1 h)

**Goal:** TS DTOs aligned with a **minimal** subset of `supply_chain_twin_data_model_and_graph_spec.md`.

**Milestones**

- [ ] `TwinEdgeDto` / `TwinEntityDto` fields for `sourceSystem?`, `sourceRef?` (optional strings).
- [ ] Barrel `index.ts` exports if useful.

**Paths:** `src/lib/supply-chain-twin/**` only.

---

## Slice 14 — Ingestion: event table (~2 h)

**Goal:** Append-only “twin saw X” spine (no background worker).

**Milestones**

- [ ] Prisma model + migration (`tenantId`, `type`, `payloadJson` or pointer, `createdAt`).
- [ ] Policy comment: max payload size enforced in writer slice.

**Paths:** `prisma/**`, optional `src/lib/supply-chain-twin/**` for types only.

---

## Slice 15 — Ingestion: writer lib (~1–1.5 h)

**Goal:** `appendIngestEvent` with size validation + unit tests.

**Milestones**

- [ ] Reject oversize payloads with stable error code (tested).
- [ ] No PII logging.

**Paths:** `src/lib/supply-chain-twin/**` only.

---

## Slice 16 — API: `GET /api/supply-chain-twin/events` (~1.5 h)

**Goal:** Recent events list (tenant-scoped, paged).

**Milestones**

- [ ] Zod query; never log raw payload; tests for 403/401.

**Paths:** `src/app/api/supply-chain-twin/events/**` (+ tests).

---

## Slice 17 — Readiness: DB-backed checks (~1.5 h)

**Goal:** Readiness `reasons` reflect migration/table health (safe operator strings only).

**Milestones**

- [ ] Implement in `getSupplyChainTwinReadinessSnapshot` (or split module); twin preview UI shows new reasons (**twin routes only**).

**Paths:** `src/lib/supply-chain-twin/**`, `src/app/api/supply-chain-twin/readiness/**`, `src/app/supply-chain-twin/**`, tests.

---

## Slice 18 — Explorer: entities wired (~1.5 h)

**Goal:** `/supply-chain-twin/explorer` lists rows from entities API.

**Milestones**

- [ ] Functional table first; loading/error states.

**Paths:** `src/app/supply-chain-twin/explorer/**`, `src/components/supply-chain-twin/**`.

---

## Slice 19 — Explorer: graph stub (~2 h)

**Goal:** Read-only graph panel fed by DTOs (mock layout acceptable).

**Milestones**

- [ ] Nodes/edges from props or API; debounced search optional.
- [ ] New dependency only in this slice + justified in PR text.

**Paths:** `src/components/supply-chain-twin/**`, `src/app/supply-chain-twin/explorer/**`, `package.json` if dep added.

---

## Slice 20 — Zod DTO package for APIs (~1.5 h)

**Goal:** Shared `schemas/*` imported by entities/edges/events routes (no behavior regression).

**Milestones**

- [ ] Extract response/query zod; routes slim down; tests still pass.

**Paths:** `src/lib/supply-chain-twin/**`, `src/app/api/supply-chain-twin/**/*.ts`, tests.

---

## Slice 21 — KPI stub (~1.5 h)

**Goal:** One “health index” (placeholder) exposed via API or readiness JSON extension.

**Milestones**

- [ ] Document meaning as **non-production**; constant or single DB row.
- [ ] Tests for shape.

**Paths:** `src/lib/supply-chain-twin/**`, `src/app/api/supply-chain-twin/**` and/or readiness lib; `prisma/**` only if new table.

---

## Slice 22 — Risk: enum + demo row (~1.5 h)

**Goal:** `TwinRiskSeverity` in Prisma + TS; optional demo seed line.

**Milestones**

- [ ] Enum migration; seed script or guarded seed block (do not widen unrelated seeds without user sign-off).

**Paths:** `prisma/**`, `src/lib/supply-chain-twin/**`, `package.json` / `prisma/seed*.mjs` **only if slice explicitly adds a script**.

---

## Slice 23 — Scenarios: workspace route (~1 h)

**Goal:** `/supply-chain-twin/scenarios` static shell (PRD surface).

**Milestones**

- [ ] In-app links from twin overview **only** (no `AppNav` edits).

**Paths:** `src/app/supply-chain-twin/scenarios/**` only.

---

## Slice 24 — Scenarios: draft `POST` (~2 h)

**Goal:** `POST /api/supply-chain-twin/scenarios` persists draft JSON (no solver).

**Milestones**

- [ ] Zod body; 400 on invalid; never log body; auth + tests.

**Paths:** `src/app/api/supply-chain-twin/scenarios/**`, `src/lib/supply-chain-twin/**`, `prisma/**` if table added.

---

## Slice 25 — Portal safety (~1 h)

**Goal:** Supplier-portal-restricted actors get consistent **403** on all twin APIs.

**Milestones**

- [ ] Shared guard helper in `src/lib/supply-chain-twin/`; applied to every twin route handler.
- [ ] Tests with mocked restriction pattern.

**Paths:** `src/lib/supply-chain-twin/**`, `src/app/api/supply-chain-twin/**`, tests.

---

## Slice 26 — `verify:sctwin` (~1 h)

**Goal:** One npm script: `tsc` + Vitest scoped to twin paths.

**Milestones**

- [ ] `package.json` script; do **not** attach to unrelated CI gates without user approval.

**Paths:** `package.json`, optionally `vitest.config.ts` **only** if required for include patterns.

---

## Slice 27 — Doc sync: R1 foundation (~1 h)

**Goal:** Update `docs/sctwin/supply_chain_twin_sprint_backlog_and_release_plan.md` — what R1 items are now true in code (links to paths).

**Milestones**

- [ ] Short subsection under **R1 — Twin Foundation** with bullets + file pointers.
- [ ] No secrets / env values.

**Paths:** `docs/sctwin/**` only.

---

## Slice 28 — Explorer: entity detail route shell (~1 h)

**Goal:** Deep-link target for a single twin entity (structure only).

**Milestones**

- [ ] App route `/supply-chain-twin/explorer/[entityId]` with layout aligned to existing explorer shell (`twin-subnav`).
- [ ] Back link to `/supply-chain-twin/explorer`; placeholder body (no heavy client graph required).

**Paths:** `src/app/supply-chain-twin/explorer/[entityId]/**`, `src/components/supply-chain-twin/**` if shared chrome only.

**Done when:** URL with a real demo `entityId` renders without 500.

---

## Slice 29 — API + repo: `GET …/entities/[id]` (~1.5 h)

**Goal:** Fetch one `SupplyChainTwinEntitySnapshot` by primary key, tenant-scoped.

**Milestones**

- [ ] `getEntitySnapshotByIdForTenant` (or equivalent) in `src/lib/supply-chain-twin/**` + Vitest (mock Prisma or existing test style).
- [ ] `GET /api/supply-chain-twin/entities/[id]` — 404 when wrong tenant / missing; same access guard as list route.

**Paths:** `src/app/api/supply-chain-twin/entities/[id]/**`, `src/lib/supply-chain-twin/**`, tests.

**Done when:** Network tab shows stable JSON shape documented in code comment.

---

## Slice 30 — Explorer table → detail deep links (~1 h)

**Goal:** Rows (or id column) link to Slice 28 route.

**Milestones**

- [ ] `Link` or router push using snapshot `id` (cuid), not business key, unless spec says otherwise.
- [ ] Keyboard-focusable hit target; no `AppNav` edits.

**Paths:** `src/components/supply-chain-twin/**` (explorer table), optionally tiny type export from lib.

**Done when:** Clicking a row opens `/supply-chain-twin/explorer/[entityId]`.

---

## Slice 31 — Entity detail UI: read-only summary (~1.5 h)

**Goal:** Detail page shows kind, key, timestamps, bounded JSON preview (Slice 29 API or RSC fetch).

**Milestones**

- [ ] Guard payload size in UI (truncate with “show more” stub acceptable).
- [ ] Loading + error states; no PII in error strings.

**Paths:** `src/app/supply-chain-twin/explorer/[entityId]/**`, `src/components/supply-chain-twin/**`.

**Done when:** Demo entity renders meaningful fields.

---

## Slice 32 — Repo + API: `GET …/scenarios` list (~1.5 h)

**Goal:** Paginated (or capped) list of `SupplyChainTwinScenarioDraft` for tenant.

**Milestones**

- [ ] Zod query (`limit`, optional `cursor`); response DTO matches existing scenario create response style where possible.
- [ ] `requireTwinApiAccess` on route; tests for empty list + 403 portal pattern.

**Paths:** `src/app/api/supply-chain-twin/scenarios/route.ts` (add `GET` next to existing `POST`), `src/lib/supply-chain-twin/scenarios-draft-repo.ts`, schemas, tests.

**Done when:** `GET` returns `{ items: [...] }` without breaking existing `POST`.

---

## Slice 33 — Scenarios workspace: drafts table (~1.5 h)

**Goal:** `/supply-chain-twin/scenarios` lists drafts from Slice 32 API (client or RSC).

**Milestones**

- [ ] Empty state + link to “create draft” (existing POST flow).
- [ ] Row links forward to Slice 40 detail route when that route exists (stub `href` + TODO acceptable until Slice 40 lands).

**Paths:** `src/app/supply-chain-twin/scenarios/**`, `src/components/supply-chain-twin/**`.

**Done when:** After creating a draft, it appears in the table after refresh or mutate.

---

## Slice 34 — API: `GET …/scenarios/[id]` (~1.5 h)

**Goal:** Single draft by id; 404 cross-tenant.

**Milestones**

- [ ] Zod response; never log `draftJson` to structured logs.
- [ ] Vitest for happy path + 404.

**Paths:** `src/app/api/supply-chain-twin/scenarios/[id]/**`, `src/lib/supply-chain-twin/**`, tests.

**Done when:** Matches list item ids from Slice 32.

---

## Slice 35 — API: `PATCH …/scenarios/[id]` (~2 h)

**Goal:** Partial update `title` and/or `draftJson` (validated JSON).

**Milestones**

- [ ] Zod body; optimistic concurrency optional (defer with comment if skipped).
- [ ] 400 on invalid JSON; tests.

**Paths:** `src/app/api/supply-chain-twin/scenarios/[id]/route.ts` (add `PATCH`), repo helper, schemas, tests.

**Done when:** UI or curl can rename a draft.

---

## Slice 36 — API: `DELETE …/scenarios/[id]` (~1–1.5 h)

**Goal:** Hard delete draft row (tenant-scoped) **or** soft-delete flag — pick one and document in route JSDoc.

**Milestones**

- [ ] 404 when missing; no cascade surprises (document Prisma `onDelete` behavior).
- [ ] Tests.

**Paths:** same as Slice 35 handler file + repo + `prisma/**` only if schema adds `deletedAt`.

**Done when:** Deleted id no longer appears on `GET` list.

---

## Slice 37 — Repo + API: `GET …/risk-signals` (~1.5 h)

**Goal:** List `SupplyChainTwinRiskSignal` rows for tenant (newest first, capped).

**Milestones**

- [ ] Zod query + response; align with `TwinRiskSeverity` TS type.
- [ ] Tests; no PII.

**Paths:** `src/app/api/supply-chain-twin/risk-signals/**`, `src/lib/supply-chain-twin/**`, schemas, tests.

**Done when:** Demo seed risk (if present) visible via API.

---

## Slice 38 — Twin overview: risk callout (~1 h)

**Goal:** `/supply-chain-twin` shows top N risk signals (fetch Slice 37 API or RSC server fetch to lib).

**Milestones**

- [ ] Link to explorer or placeholder “Details coming” — no new top-nav entry.

**Paths:** `src/app/supply-chain-twin/page.tsx`, `src/components/supply-chain-twin/**`.

**Done when:** Empty + non-empty states handled.

---

## Slice 39 — API: `POST …/events` append (~2 h)

**Goal:** Authenticated append to ingest spine using existing `appendIngestEvent` / size cap (reuse writer from Slice 15).

**Milestones**

- [ ] Zod body (`type`, `payload`); reject oversize with stable error code.
- [ ] `GET` on same resource unchanged; Vitest for 400/201.

**Paths:** `src/app/api/supply-chain-twin/events/route.ts` (add `POST`) or split handler per Next conventions; `src/lib/supply-chain-twin/**`, tests.

**Done when:** New row appears on `GET /api/supply-chain-twin/events`.

---

## Slice 40 — App route: `/supply-chain-twin/scenarios/[id]` (~1.5 h)

**Goal:** Read-only scenario draft view (title, status, updatedAt, JSON preview).

**Milestones**

- [ ] Uses Slice 34 fetch; 404 page friendly.
- [ ] Link back to scenarios list.

**Paths:** `src/app/supply-chain-twin/scenarios/[id]/**`, components under twin only.

**Done when:** Deep-link from list works.

---

## Slice 41 — Explorer: recent ingest events strip (~1.5 h)

**Goal:** Thin panel on explorer (or detail page) showing last N events from existing `GET /events`.

**Milestones**

- [ ] Truncate type/payload display; no raw payload in logs from client.

**Paths:** `src/app/supply-chain-twin/explorer/**`, `src/components/supply-chain-twin/**`.

**Done when:** Works with empty events list.

---

## Slice 42 — Graph panel: live edges for selection (~2 h)

**Goal:** Replace or augment mock graph data with `GET /api/supply-chain-twin/edges?snapshotId=…&direction=both` when user selects an entity in explorer.

**Milestones**

- [ ] Loading/error on refetch; debounce optional.
- [ ] No new npm dependency unless unavoidable (justify in handoff).

**Paths:** `src/components/supply-chain-twin/twin-graph-stub-panel.tsx` (rename later if needed), explorer client/parent props.

**Done when:** Demo tenant shows edges matching DB.

---

## Slice 43 — Scenarios compare: route shell (~1 h)

**Goal:** `/supply-chain-twin/scenarios/compare` static shell + instructions.

**Milestones**

- [ ] Linked from scenarios page only (inline link), not global nav.

**Paths:** `src/app/supply-chain-twin/scenarios/compare/**`.

**Done when:** Route renders under twin layout.

---

## Slice 44 — Scenarios compare: dual draft fetch (~1.5–2 h)

**Goal:** Query params `left`, `right` (cuid) load two drafts via Slice 34 API (client) and render side-by-side read-only JSON + diff stub (e.g. `===` highlight or textual “same/different root keys”).

**Milestones**

- [ ] Mismatched tenant returns user-safe error (403/404 per existing patterns).
- [ ] No solver — narrative/compare only.

**Paths:** `src/app/supply-chain-twin/scenarios/compare/**`, `src/components/supply-chain-twin/**`.

**Done when:** Two known demo ids render without crash.

---

## Slice 45 — API: twin catalog metrics (~1.5 h)

**Goal:** `GET /api/supply-chain-twin/metrics` (or `/summary`) returns **counts only** — entities, edges, events, scenario drafts, risk signals — single JSON, cheap queries (`count`).

**Milestones**

- [ ] Strict caps / timeouts comment; no unbounded scans.
- [ ] Tests for shape + auth denial.

**Paths:** `src/app/api/supply-chain-twin/metrics/**`, `src/lib/supply-chain-twin/**`, schemas, tests.

**Done when:** Overview page can optionally consume in a later slice without schema change.

---

## Slice 46 — Observability: request id in twin logs (~1 h)

**Goal:** If client sends `x-request-id` (or similar), include stable id in `logSctwinApiWarn` / `logSctwinApiError` context; else generate once per request and optionally echo in response header.

**Milestones**

- [ ] No PII; twin API routes only (do not widen to whole app).

**Paths:** `src/app/api/supply-chain-twin/_lib/sctwin-api-log.ts`, `src/app/api/supply-chain-twin/**/*.ts` as needed, tests if log helpers are unit-tested.

**Done when:** Two failing requests produce distinguishable ids in log output (manual verify ok).

---

## Slice 47 — Doc sync: R2 staging (~1 h)

**Goal:** Update `docs/sctwin/supply_chain_twin_sprint_backlog_and_release_plan.md` with a short **“R2 staging (slices 28–47)”** subsection: bullets mapping themes (entity drill-in, scenarios CRUD+compare, risk read path, ingest write, metrics, observability) to repo areas — no secrets.

**Milestones**

- [ ] Cross-link back to this milestone file.

**Paths:** `docs/sctwin/**` only.

**Done when:** Product readers see what the next tranche unlocks.

---

## Prompt template for the agent

```text
Follow docs/sctwin/agent_milestones_one_agent.md. Implement Slice N only.
Respect **Cosmetics freeze** — do not edit listed global chrome files unless this slice explicitly allows an exception; if blocked, stop and report.
Do not edit files outside the slice’s Paths unless blocked — then list the conflict and stop.
End with: tsc clean, and note any migration/seed commands for humans.
```

---

## Reference pack

Full product and technical specs live alongside this file under `docs/sctwin/` (README, PRD, data model, ingestion, permissions, etc.).
