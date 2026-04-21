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
