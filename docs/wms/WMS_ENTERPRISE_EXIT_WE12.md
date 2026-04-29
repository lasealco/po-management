# WMS Enterprise Exit — WE-12 sign-off

**Status:** Closed — **2026-04-29** (capsule **WE-12** of [`ENTERPRISE_TRACK.md`](./ENTERPRISE_TRACK.md)).

**Scope:** This document records **verification gates**, **demo/seed expectations**, and **explicit sign-off** that remaining blueprint gaps in [`GAP_MAP.md`](./GAP_MAP.md) are **intentional deferrals**, not undocumented drift.

## Closure statement

The **Enterprise WMS** prompt sequence **`WE-01` … `WE-12`** is **complete** at the depth described across [`GAP_MAP.md`](./GAP_MAP.md), linked ADRs/specs (`WMS_*`), and [`ENTERPRISE_TRACK.md`](./ENTERPRISE_TRACK.md). Further blueprint depth (field-level RBAC matrix, FEFO engines, TMS yard automation, in-map WMS layers on CT globe, etc.) moves to **product backlog** and the phased program in [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md) rather than extending `ENTERPRISE_TRACK.md`.

## Verification checklist (gates run locally)

| Gate | Command | Result (2026-04-29) |
|------|---------|---------------------|
| TypeScript | `npx tsc --noEmit` | Pass |
| WMS library Vitest | `npx vitest run src/lib/wms` | Pass (**32** tests, **10** files) |

**Production build:** `npm run vercel-build` / **`npm run build`** run on **Vercel** when **`main`** is pushed; local builds may require `.env` / `DATABASE_URL` where Next touches the DB.

## Critical paths (smoke)

| Area | Path / surface |
|------|----------------|
| WMS hub | `/wms` — overview KPIs ([`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md)), CT shipment map link when dual-grant ([`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md)) |
| Operations | `/wms/operations` — tasks, outbound, dock appointments ([`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)) |
| Stock | `/wms/stock` — balances + ledger + CSV + per-user saved ledger views ([`GAP_MAP.md`](./GAP_MAP.md) inventory inquiry row) |
| Setup | `/wms/setup` — zones, bins, rack map ([`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md)) |
| Billing | `/wms/billing` — Phase B events ([`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)) |
| API | `POST /api/wms` — handlers `src/lib/wms/post-actions.ts`; `GET /api/wms`, optional `?homeKpis=1` |

## Seed / demo notes

Aligned with [`docs/database-neon.md`](../database-neon.md) and repo **`AGENTS.md`** / **`CLAUDE.md`** pointers ("same DB everywhere"):

- Tenant **`demo-company`**; main tenant/workflow seed: **`USE_DOTENV_LOCAL=1 npm run db:seed`**.
- WMS warehouse/tasks/inventory: **`USE_DOTENV_LOCAL=1 npm run db:seed:wms-demo`** (requires demo tenant from main seed; warehouse **`WH-DEMO-DC1`**).
- Same **`DATABASE_URL`** for local Neon/Vercel or demos appear empty.

## Intentional deferrals (reviewed)

Consistent with **`GAP_MAP.md`** Phase A bullet and 🟡/❌ rows: multi-level zone graph / aisle entities (**[`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md)**); full lot master / serial genealogy (**[`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md)**); field-level permission matrix (**[`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md)**); solver-grade allocation (**[`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)**); TMS-grade dock yard (**[`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)**); automated CPQ→outbound (**[`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)**); CT map embedded WMS floor (**[`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md)**); receiving line variance (**[`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md)**).

## Next wave pointer

Use **[`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md)** for CT+WMS phased priorities and handoff notes. New vertical slices should update **`GAP_MAP.md`** when schema or API behavior changes.
