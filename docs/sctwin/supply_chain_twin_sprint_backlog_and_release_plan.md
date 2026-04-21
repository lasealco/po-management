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

This subsection maps the **R2-shaped** work already landed in the preview (slices **28–47** in the agent milestone plan) to concrete repo areas. It is **not** a claim that R2 product goals are complete—only that the listed surfaces and read/write paths exist for demos and further iteration. For slice-by-slice scope, see **[One-agent milestones (slices 1–47)](agent_milestones_one_agent.md)**.

- **Entity drill-in (explorer → snapshot):** App shell `src/app/supply-chain-twin/explorer/[entityId]/`; list → detail links in `src/components/supply-chain-twin/twin-explorer-entities-table.tsx`; read APIs `src/app/api/supply-chain-twin/entities/route.ts`, `src/app/api/supply-chain-twin/entities/[id]/route.ts` with `src/lib/supply-chain-twin/repo.ts`; JSON preview `src/components/supply-chain-twin/twin-entity-json-preview.tsx`.
- **Scenarios CRUD + compare:** Workspace `src/app/supply-chain-twin/scenarios/`; draft APIs `src/app/api/supply-chain-twin/scenarios/route.ts`, `src/app/api/supply-chain-twin/scenarios/[id]/route.ts` with `src/lib/supply-chain-twin/scenarios-draft-repo.ts` and Zod under `src/lib/supply-chain-twin/schemas/`; drafts UI `src/components/supply-chain-twin/twin-scenarios-drafts-panel.tsx`; read-only detail `src/app/supply-chain-twin/scenarios/[id]/`; compare route `src/app/supply-chain-twin/scenarios/compare/` plus `src/components/supply-chain-twin/twin-scenarios-compare-panel.tsx` and `scenario-draft-compare-summary.ts`.
- **Risk read path:** API `src/app/api/supply-chain-twin/risk-signals/route.ts` with `src/lib/supply-chain-twin/risk-signals-repo.ts`; overview callout `src/components/supply-chain-twin/twin-risk-signals-callout.tsx` on `src/app/supply-chain-twin/page.tsx`; Prisma models `SupplyChainTwinRiskSignal` / `TwinRiskSeverity` in `prisma/schema.prisma`.
- **Ingest write + explorer visibility:** Append path `POST` on `src/app/api/supply-chain-twin/events/route.ts` using `src/lib/supply-chain-twin/ingest-writer.ts`; recent-events strip `src/components/supply-chain-twin/twin-explorer-recent-events-strip.tsx`.
- **Graph edges (selection-driven):** `GET` edges `src/app/api/supply-chain-twin/edges/route.ts` with `src/lib/supply-chain-twin/edges-repo.ts`; live panel wiring in `src/components/supply-chain-twin/twin-graph-stub-panel.tsx` (explorer integration under `src/app/supply-chain-twin/explorer/`).
- **Catalog metrics:** `GET` `src/app/api/supply-chain-twin/metrics/route.ts` with `src/lib/supply-chain-twin/twin-catalog-metrics.ts` and response schema in `src/lib/supply-chain-twin/schemas/twin-api-responses.ts` (counts only; suitable for a future overview tile).
- **Twin API observability:** Request correlation in `src/app/api/supply-chain-twin/_lib/sctwin-api-log.ts` (`resolveSctwinRequestId`, `requestId` on `logSctwinApiWarn` / `logSctwinApiError`, `x-request-id` echoed on responses); applied across handlers under `src/app/api/supply-chain-twin/**`.

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
