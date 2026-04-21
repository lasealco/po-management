# Supply Chain Twin — one-agent milestones (1–2 h slices)

Use this doc as the **single source of truth** for Cursor/Codex agents: paste or `@`-reference this file, then say **which slice number** to implement (**Slices 1–27**).

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
