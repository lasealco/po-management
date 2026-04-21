# Supply Chain Twin Sprint Backlog and Release Plan

**Agent milestones M1–M7** (readiness → explorer + API guardrails): implemented for the in-app preview; **R1–R6** below remains the forward product backlog.

## R1 — Twin Foundation
- object model
- relationship graph
- source references
- current-state engine
- base explorer UI

### R1 — now in code (preview / M1–M26)

The bullets above are the **product** bar for R1. The following is what exists **today** in this repo (paths are repo-root relative). No secrets or env values.

- **Entity object store (materialized snapshots):** Prisma `SupplyChainTwinEntitySnapshot` in `prisma/schema.prisma`; tenant list + keyset pagination in `src/lib/supply-chain-twin/repo.ts`; catalog API `src/app/api/supply-chain-twin/entities/route.ts`.
- **Relationship graph (directed edges):** Prisma `SupplyChainTwinEntityEdge`; queries in `src/lib/supply-chain-twin/edges-repo.ts`; API `src/app/api/supply-chain-twin/edges/route.ts`.
- **Source references (DTO shape):** Optional provenance fields on `TwinEntityDto` / `TwinEdgeDto` in `src/lib/supply-chain-twin/dto.ts` (payloads also use JSON on snapshots).
- **Ingest spine (append-only events, not a full reconciliation engine):** Prisma `SupplyChainTwinIngestEvent`; writer with payload size cap in `src/lib/supply-chain-twin/ingest-writer.ts`; list API `src/app/api/supply-chain-twin/events/route.ts`. *End-to-end “current-state engine” behavior from the PRD is still future work.*
- **Readiness + operator messaging:** `src/lib/supply-chain-twin/readiness.ts`, API `src/app/api/supply-chain-twin/readiness/route.ts`; non-production health index stub in `src/lib/supply-chain-twin/kpi-stub.ts` (included in readiness JSON).
- **Base explorer UI + graph stub:** App routes `src/app/supply-chain-twin/page.tsx`, `src/app/supply-chain-twin/explorer/page.tsx`; shared chrome for the twin shell in `src/components/supply-chain-twin/twin-subnav.tsx`; explorer table and read-only graph stub in `src/components/supply-chain-twin/twin-explorer-entities-table.tsx`, `src/components/supply-chain-twin/twin-graph-stub-panel.tsx`.
- **Scenarios surface + draft persistence:** Workspace `src/app/supply-chain-twin/scenarios/page.tsx`; create draft `src/app/api/supply-chain-twin/scenarios/route.ts` with persistence in `src/lib/supply-chain-twin/scenarios-draft-repo.ts` (Prisma `SupplyChainTwinScenarioDraft`).
- **Risk severity enum + demo-friendly row:** Prisma `TwinRiskSeverity` and `SupplyChainTwinRiskSignal`; TS exports `src/lib/supply-chain-twin/risk.ts`; optional demo seed line in `prisma/seed-supply-chain-twin-demo.mjs`.
- **Shared API validation:** Zod schemas under `src/lib/supply-chain-twin/schemas/` (entities, edges, events, readiness, scenario create).
- **Supplier portal safety (all twin HTTP handlers):** `src/lib/supply-chain-twin/sctwin-api-access.ts` (used from each route under `src/app/api/supply-chain-twin/**`).
- **Local verify script:** `npm run verify:sctwin` and `npm run test:sctwin` in `package.json` (TypeScript project check + Vitest scoped to twin lib + twin API tests).

## R2 — Expected State and Risk
- expected future state
- risk calculations
- executive dashboard
- product/supplier/order twin views

### R2 staging (slices 28–47)

This subsection maps the **R2-shaped** work already landed in the preview (slices **28–47** in the agent milestone plan) to concrete repo areas. It is **not** a claim that R2 product goals are complete—only that the listed surfaces and read/write paths exist for demos and further iteration. For slice-by-slice scope, see **[One-agent milestones (slices 1–107)](agent_milestones_one_agent.md)**.

- **Entity drill-in (explorer → snapshot):** App shell `src/app/supply-chain-twin/explorer/[entityId]/`; list → detail links in `src/components/supply-chain-twin/twin-explorer-entities-table.tsx`; read APIs `src/app/api/supply-chain-twin/entities/route.ts`, `src/app/api/supply-chain-twin/entities/[id]/route.ts` with `src/lib/supply-chain-twin/repo.ts`; JSON preview `src/components/supply-chain-twin/twin-entity-json-preview.tsx`.
- **Scenarios CRUD + compare:** Workspace `src/app/supply-chain-twin/scenarios/`; draft APIs `src/app/api/supply-chain-twin/scenarios/route.ts`, `src/app/api/supply-chain-twin/scenarios/[id]/route.ts` with `src/lib/supply-chain-twin/scenarios-draft-repo.ts` and Zod under `src/lib/supply-chain-twin/schemas/`; drafts UI `src/components/supply-chain-twin/twin-scenarios-drafts-panel.tsx`; read-only detail `src/app/supply-chain-twin/scenarios/[id]/`; compare route `src/app/supply-chain-twin/scenarios/compare/` plus `src/components/supply-chain-twin/twin-scenarios-compare-panel.tsx` and `scenario-draft-compare-summary.ts`.
- **Risk read path:** API `src/app/api/supply-chain-twin/risk-signals/route.ts` with `src/lib/supply-chain-twin/risk-signals-repo.ts`; overview callout `src/components/supply-chain-twin/twin-risk-signals-callout.tsx` on `src/app/supply-chain-twin/page.tsx`; Prisma models `SupplyChainTwinRiskSignal` / `TwinRiskSeverity` in `prisma/schema.prisma`.
- **Ingest write + explorer visibility:** Append path `POST` on `src/app/api/supply-chain-twin/events/route.ts` using `src/lib/supply-chain-twin/ingest-writer.ts`; recent-events strip `src/components/supply-chain-twin/twin-explorer-recent-events-strip.tsx`.
- **Graph edges (selection-driven):** `GET` edges `src/app/api/supply-chain-twin/edges/route.ts` with `src/lib/supply-chain-twin/edges-repo.ts`; live panel wiring in `src/components/supply-chain-twin/twin-graph-stub-panel.tsx` (explorer integration under `src/app/supply-chain-twin/explorer/`).
- **Catalog metrics:** `GET` `src/app/api/supply-chain-twin/metrics/route.ts` with `src/lib/supply-chain-twin/twin-catalog-metrics.ts` and response schema in `src/lib/supply-chain-twin/schemas/twin-api-responses.ts` (integer **counts** on the wire; `generatedAt` arrived in the **R2 extension** tranche — see below).
- **Twin API observability:** Request correlation in `src/app/api/supply-chain-twin/_lib/sctwin-api-log.ts` (`resolveSctwinRequestId`, `requestId` on `logSctwinApiWarn` / `logSctwinApiError`, `x-request-id` echoed on responses); applied across handlers under `src/app/api/supply-chain-twin/**`.

### R2 extension (slices 48–67)

Product-facing map of the **next tranche** after R2 staging: compare polish, overview metrics freshness, scenario list/lifecycle, explorer export/load UX, catalog list filters, twin API observability refinements, Prisma hot-path tuning, compare-friendly seeds, and short onboarding docs. **Slice-by-slice acceptance criteria** live in **[One-agent milestones (slices 1–107)](agent_milestones_one_agent.md)** (focus **48–67**).

- **Scenarios compare (validation + diff v1):** `src/app/supply-chain-twin/scenarios/compare/` with `src/components/supply-chain-twin/twin-scenarios-compare-panel.tsx` and small compare helpers under `src/lib/supply-chain-twin/` — safe `left` / `right` query handling (no tenant leakage in copy) and a read-only top-level JSON key summary (no solver).
- **Twin overview metrics UX:** Counts strip `src/components/supply-chain-twin/twin-catalog-metrics-strip.tsx` on `src/app/supply-chain-twin/page.tsx`; `GET /api/supply-chain-twin/metrics` includes integer totals **and** an ISO `generatedAt` field for “as of” labels (`src/app/api/supply-chain-twin/metrics/route.ts`, schema `twinCatalogMetricsResponseSchema` in `src/lib/supply-chain-twin/schemas/twin-api-responses.ts`).
- **Scenario drafts list + lifecycle APIs:** Cursor/keyset list and UI pagination — `src/lib/supply-chain-twin/twin-scenarios-drafts-client.ts`, `src/components/supply-chain-twin/twin-scenarios-drafts-panel.tsx`, `src/app/api/supply-chain-twin/scenarios/route.ts`; status-only `PATCH` and `POST …/scenarios/[id]/duplicate` under `src/app/api/supply-chain-twin/scenarios/**` with repo helpers in `src/lib/supply-chain-twin/scenarios-draft-repo.ts`.
- **Scenarios workspace navigation:** Compare entry from the twin scenarios shell — `src/components/supply-chain-twin/twin-subnav.tsx` (in-app only; no global app nav edits).
- **Explorer table UX:** Skeleton loading, row count copy, and capped JSON export of **visible** rows — `src/components/supply-chain-twin/twin-explorer-entities-table.tsx` with explorer copy on `src/app/supply-chain-twin/explorer/page.tsx`.
- **Catalog / activity API filters (for upcoming UI):** `type` on `src/app/api/supply-chain-twin/events/route.ts`; `entityKind` allowlist on `src/app/api/supply-chain-twin/entities/route.ts`; `severity` on `src/app/api/supply-chain-twin/risk-signals/route.ts` — query schemas under `src/lib/supply-chain-twin/schemas/`.
- **Twin API observability (extension):** Milestones include echoing a stable request correlation header on **success** JSON as well as errors (`src/app/api/supply-chain-twin/**/*.ts`, shared helpers in `src/app/api/supply-chain-twin/_lib/sctwin-api-log.ts`) — see milestone slice 64 in the linked doc.
- **Entity detail “twin activity” teaser:** Milestone targets last *k* ingest events on `src/app/supply-chain-twin/explorer/[entityId]/` using existing events APIs (slice 65 in the linked doc).
- **Database hot-path indexes (twin-only):** Milestone adds composite indexes justified by list/query patterns — `prisma/schema.prisma` + `prisma/migrations/**` (slice 66).
- **Compare demo ergonomics:** Milestone extends `prisma/seed-supply-chain-twin-demo.mjs` (or guarded block) with a **second** scenario draft row so compare opens with two distinct JSON shapes without manual creation (slice 67).
- **Onboarding docs:** [`glossary.md`](./glossary.md) linked from [`README.md`](./README.md); this subsection gives readers one place to map **themes → repo areas** for slices 48–67.

### R3 staging (slices 68–87)

Forward **agent tranche** after the R2 extension: event list hardening (time window, optional payload omission, optional append idempotency), entity list summary mode, scenario `draftJson` size limits, deeper compare summaries, metrics breakdown + overview UI, edge endpoint filters + explorer deep link, readiness enrichment, operator runbook stub, small scenario/compare UX wins, stable error-code registry, richer demo seed + ingest index, explorer empty-state polish, and a multi-step API contract test. **Slice-by-slice acceptance criteria** live in **[One-agent milestones (slices 1–107)](agent_milestones_one_agent.md)** (focus **68–87**).

- **Events API hardening:** `src/app/api/supply-chain-twin/events/route.ts` + query/body schemas in `src/lib/supply-chain-twin/schemas/` cover `since`/`until`, `includePayload`, and append idempotency (`Idempotency-Key` via `src/lib/supply-chain-twin/ingest-writer.ts`), with twin-scoped tests under `src/app/api/supply-chain-twin/events/route.test.ts` and `src/lib/supply-chain-twin/ingest-writer.test.ts`.
- **Entities summary mode:** `GET /api/supply-chain-twin/entities` supports `fields=summary|full` in `src/app/api/supply-chain-twin/entities/route.ts`, with contract helpers in `src/lib/supply-chain-twin/schemas/twin-entities-query.ts` and related twin API response schemas.
- **Scenario draft guardrails + compare depth:** size-capped `PATCH` flow in `src/app/api/supply-chain-twin/scenarios/[id]/route.ts` and compare helpers/UI (`src/lib/supply-chain-twin/scenario-draft-compare-summary.ts`, `src/app/supply-chain-twin/scenarios/compare/page.tsx`, `src/components/supply-chain-twin/twin-scenarios-compare-key-diff-list.tsx`).
- **Metrics breakdown + overview consumption:** `entityCountsByKind` and timestamped metrics in `src/app/api/supply-chain-twin/metrics/route.ts` + `src/lib/supply-chain-twin/twin-catalog-metrics.ts`, rendered on overview via `src/components/supply-chain-twin/twin-catalog-metrics-strip.tsx` and `src/app/supply-chain-twin/page.tsx`.
- **Edges endpoint filters + explorer focus deep link:** endpoint-side filtering in `src/app/api/supply-chain-twin/edges/route.ts` with repo/query logic in `src/lib/supply-chain-twin/edges-repo.ts` and `src/lib/supply-chain-twin/schemas/twin-edges-query.ts`; bookmarkable focus handling in `src/app/supply-chain-twin/explorer/page.tsx` and `src/lib/supply-chain-twin/explorer-focus-query.ts`.
- **Readiness enrichment + runbook docs:** readiness snapshot now includes non-sensitive catalog presence in `src/lib/supply-chain-twin/readiness.ts` and route contract in `src/app/api/supply-chain-twin/readiness/route.ts`; operator docs land in `docs/sctwin/runbook.md` with index links from `docs/sctwin/README.md`.
- **Scenario detail / compare UX niceties:** inline rename and share-link behavior live under `src/app/supply-chain-twin/scenarios/[id]/` and `src/app/supply-chain-twin/scenarios/compare/` with shared widgets in `src/components/supply-chain-twin/**`.
- **Twin error-contract consistency:** stable error code registry sits in `src/lib/supply-chain-twin/` and is consumed by twin route handlers under `src/app/api/supply-chain-twin/**` to reduce code-string drift.
- **Demo data + ingest query performance:** twin-only seed extensions in `prisma/seed-supply-chain-twin-demo.mjs` and ingest-focused indexes in `prisma/schema.prisma` + `prisma/migrations/**` support filter/demo reliability.
- **Explorer empty/error guidance + integration contract test:** UX guidance in `src/app/supply-chain-twin/explorer/**` and `src/components/supply-chain-twin/**`; linear twin API happy-path coverage under `src/app/api/supply-chain-twin/**/*.test.ts` keeps `verify:sctwin` aligned with key contracts.

### R4 staging (slices 88–107)

Forward tranche after R3 staging focused on graph/drill-in depth, operational review workflows, stronger contracts, and release hardening. **Slice-by-slice acceptance criteria** live in **[One-agent milestones (slices 1–107)](agent_milestones_one_agent.md)** (focus **88–107**).

- **Entity neighborhood APIs + detail UX:** `GET /api/supply-chain-twin/entities/[id]/neighbors` and a neighbors panel on `src/app/supply-chain-twin/explorer/[entityId]/` for one-hop context.
- **Risk operations flow:** risk acknowledge/unack endpoints + overview split of open vs acknowledged under `src/app/api/supply-chain-twin/risk-signals/**` and `src/components/supply-chain-twin/**`.
- **Scenario governance:** scenario history API + timeline UI, plus compare export improvements for review workflows.
- **Events operations:** filtered event export endpoint and explorer export actions that preserve current filters.
- **Entitlement and guardrails:** centralized twin feature gating for APIs and twin app routes, plus shared request budget limits.
- **Contract quality gates:** docs-backed endpoint contracts, schema conformance tests, and stricter twin-only verify scripts.
- **Scale-readiness:** scenario-history indexes, optional large fixture seed, and server-driven pagination controls for explorer.
- **Docs and operations:** sprint map, runbook troubleshooting matrix, and explicit release validation command.

## R3 — AI Assistant
- natural-language query layer
- grounded answers
- object drill-through
- recommendation stubs

## R4 — Prediction Layer
- ETA risk
- stock-out prediction
- supplier-risk prediction

## R5 — Scenario Engine
- what-if model
- scenario compare
- save/share scenarios

## R6 — Recommendation and Action Layer
- action recommendations
- task generation
- escalation hooks
