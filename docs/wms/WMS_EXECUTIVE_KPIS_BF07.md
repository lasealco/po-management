# Executive KPIs — BF-07 slice (OTIF / labor / slotting proxies)

**Purpose:** Extend **WE-09** operational executive KPIs ([`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md)) with **blueprint-aligned narratives** that leadership can scan without a BI warehouse — **not** full OTIF rate modeling, labor productivity rates, or ABC slotting analytics.

**Authority:** Capsule **BF-07** ([`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md)); baseline **`fetchWmsHomeKpis`** ([`src/lib/wms/wms-home-kpis.ts`](../../src/lib/wms/wms-home-kpis.ts)).

---

## What landed (BF-07)

| Signal | Definition | Sources |
|--------|------------|---------|
| **Outbound past due (OTIF proxy)** | Count **`OutboundOrder`** rows with **`requestedShipDate`** set to **before** the **UTC** calendar day start for “now”, **`status`** in `DRAFT` \| `RELEASED` \| `PICKING` \| `PACKED`. | `OutboundOrder` |
| **Labor proxy** | **`openPickTasks`** — same as operational tile: **`WmsTask`** with **`taskType = PICK`**, **`status = OPEN`**. Task counts are backlog volume, **not** picks/hour productivity. | `WmsTask` |
| **Slotting proxy** | **`openReplenishmentTasks`** — **`WmsTask`** with **`taskType = REPLENISH`**, **`status = OPEN`**. Interpret as pick-face pressure / replenishment queue depth, **not** ABC classification or slot optimization. | `WmsTask` |
| **Narratives** | Short strings derived from the three metrics above (`buildExecutiveNarratives`) for `/wms` “Blueprint narratives” panel. | Pure helper + UI |

## Warehouse scope (`wh` / API)

`GET /api/wms?homeKpis=1` accepts optional **`wh`** or **`warehouseId`** — must match a **`Warehouse.id`** for the demo tenant or it is **ignored** (tenant-wide counts; a scope note is returned).

When scoped:

- Tiles, confidence signals, dock/VAS/holds/outbound/pick/replen/movements/billing aggregates filter by **`warehouseId`** where the schema supports it.
- **Receiving pipeline** remains **tenant-wide**: inbound **`Shipment`** rows are not keyed to **`Warehouse`** in this KPI definition.

`/wms?wh=<warehouseId>` drives the same scope in the UI (warehouse dropdown).

---

## Explicit backlog (not BF-07)

- True **OTIF %** (delivered vs promised by lane/customer), **labor productivity** (hours, engineered standards), **slotting optimization** (ABC, velocity curves, cubic utilization).
- Local-site **midnight** for dock “today” (still **UTC** in WE-09/BF-07 — see [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md)).

_Last updated: 2026-05-04 — **BF-53** labor timing KPI extension (`laborTiming`, [`WMS_LABOR_BF53.md`](./WMS_LABOR_BF53.md)); **2026-05-02** — **BF-20** computed proxy rates on `fetchWmsHomeKpis` (`rates` + `rateMethodology`); **BF-07** narratives unchanged._

---

## BF-20 — Executive KPI rate proxies (minimal)

**Purpose:** Add **numeric rates** alongside BF-07 counts so **`GET /api/wms?homeKpis=1`** and **`/wms`** explain denominators without claiming delivered OTIF %, engineered labor productivity, or ABC slotting.

| Field | Definition |
|-------|------------|
| **`rates.otifPastDueSharePercent`** | Past-due scheduled orders ÷ **scheduled cohort** × 100 (**one decimal**). **Scheduled cohort** = active outbound (`DRAFT`–`PACKED`) with **`requestedShipDate` not null**. **Past due** matches BF-07 (date **before** UTC day start). **`null`** when cohort count is **0**. |
| **`rates.outboundScheduledCohortCount`** | Denominator for the OTIF proxy rate (scheduled in-flight orders). |
| **`rates.pickTasksPerActiveOutbound`** | **`openPickTasks` ÷ max(1, active outbound count)** — **two decimals**; backlog **intensity**, not picks/hour. |
| **`rates.replenishmentShareOfPickFaceWorkloadPercent`** | **`openReplenishmentTasks` ÷ (openPick + openReplenish) × 100** (**one decimal**); **0** when both queues are empty. |

**Payload:** `rateMethodology` mirrors these definitions as bullet strings for dashboard/API parity (`WMS_HOME_RATE_METHODOLOGY_BF20` in `wms-home-kpis.ts`).

**Explicit backlog (not BF-20):** Delivered OTIF % by lane/customer, labor hours vs standards (see **BF-53** for standard-minutes + optional elapsed timing only), velocity-based slotting optimization.

_Last updated: 2026-05-02 — BF-20 minimal rates shipped._

---

## BF-53 — Labor timing on home KPIs (minimal)

**Purpose:** Add a **7-day completed-task labor timing** summary when tasks have **`standardMinutes`** and **`startedAt`** / **`completedAt`** — extends **`rateMethodology`** with a BF-53 bullet (`WMS_HOME_KPI_METHODOLOGY` in `wms-home-kpis.ts`). Not payroll, engineered rates in hours, or LMS integration.

**Doc:** [`WMS_LABOR_BF53.md`](./WMS_LABOR_BF53.md).

_Last updated: 2026-05-04 — **BF-53** labor timing on `fetchWmsHomeKpis`; **BF-20** rate proxies unchanged aside from shared methodology array._
