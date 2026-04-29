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

_Last updated: 2026-04-29 — BF-07 shipped._
