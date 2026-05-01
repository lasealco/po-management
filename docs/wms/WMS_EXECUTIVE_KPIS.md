# WMS executive KPIs (WE-09)

**Purpose:** Agreed leadership-facing metrics for **`/wms`** “At a glance” vs blueprint-style dashboards — implemented as **operational tiles + executive highlights + optional JSON export**, not as a separate BI warehouse.

**Agreement:** These KPIs prioritize **floor-to-leadership alignment** (receiving, dock, VAS, inventory quality) using tables already in repo (`Shipment.wmsReceiveStatus`, `WmsDockAppointment`, `WmsTask`, `InventoryBalance`). **BF-07** adds **proxies + narratives**; **BF-20** adds **computed proxy rates** (`rates` + `rateMethodology` on `fetchWmsHomeKpis` — [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md)). Full blueprint delivered OTIF %, engineered labor productivity, and ABC slotting optimization remain **out of scope** unless modeled elsewhere.

## KPI inventory

| KPI | Definition | Primary sources |
|-----|------------|-----------------|
| **Receiving pipeline** | Count of inbound **`Shipment`** rows whose **`wmsReceiveStatus`** is one of `EXPECTED`, `AT_DOCK`, `RECEIVING`, `DISCREPANCY` (active receiving work not yet terminal). | `Shipment` + `PurchaseOrder.tenantId` |
| **Dock windows (today)** | Count of **`WmsDockAppointment`** rows with **`status = SCHEDULED`** whose window overlaps the **UTC** calendar day containing “now”. | `WmsDockAppointment` |
| **Open VAS workload** | Count of **`WmsTask`** rows with **`taskType = VALUE_ADD`** and **`status = OPEN`**. | `WmsTask` |
| **Hold rate (% of rows)** | `onHold` balance rows ÷ total balance rows × 100, **one decimal**, **0%** if no rows. | `InventoryBalance` |
| **Outbound past due (BF-07)** | Active outbound (`DRAFT`–`PACKED`) with **`requestedShipDate`** **before** UTC day start. OTIF **risk** proxy, not delivered OTIF %. | `OutboundOrder` |
| **OTIF proxy rate (BF-20)** | Past-due count ÷ scheduled cohort × 100 (`rates.otifPastDueSharePercent`); cohort = active outbound with **`requestedShipDate` set**. | Same + `fetchWmsHomeKpis` |
| **Open pick tasks (BF-07)** | **`WmsTask`** **`PICK`** + **`OPEN`** — labor **backlog** proxy. | `WmsTask` |
| **Pick intensity (BF-20)** | Open picks ÷ max(1, active outbound) — **`rates.pickTasksPerActiveOutbound`**. | `WmsTask` + `OutboundOrder` |
| **Open replenishments (BF-07)** | **`WmsTask`** **`REPLENISH`** + **`OPEN`** — slotting / pick-face **pressure** proxy. | `WmsTask` |
| **Replenishment workload share (BF-20)** | REPLENISH ÷ (PICK + REPLENISH) open tasks × 100. | `WmsTask` |

### Operational tiles (triage)

unchanged from prior **`WmsHomeOverview`** behavior: open tasks by type (including **Open VAS tasks** as its own tile), outbound in flight, active waves, balance rows, on-hold balances, unbilled billing events, movements in last 7 days.

### Confidence signals

Three derived signals remain: **task pressure** (threshold bands on open tasks), **stock quality holds** (any on-hold vs clear), **ledger velocity** (7d movement count).

## Where it surfaces

| Surface | Notes |
|---------|--------|
| **`/wms`** | **Executive highlights** row + tiles + confidence signals (`src/components/wms-home-overview.tsx`). |
| **`GET /api/wms?homeKpis=1`** | Same KPI payload as JSON for integrations/scripts (`org.wms` **view** gate). Optional **`wh`** or **`warehouseId`** scopes warehouse-aware counts (see BF-07 doc). Full dashboard payload is unchanged: **`GET /api/wms`** without this flag. |

Implementation: **`src/lib/wms/wms-home-kpis.ts`** (`fetchWmsHomeKpis`).

## Caveats

- **Dock “today”** uses **UTC** midnight boundaries — align reporting TZ in a future slice if leadership requires local-site midnight.
- **`BF-07`:** Optional warehouse scope via **`wh`** / **`warehouseId`** on **`homeKpis`** or **`/wms?wh=`**; receiving pipeline stays **tenant-wide** when scoped (see [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md)).
- **`BF-20`:** **`rates`** fields are **proxy shares/intensity** from operational tables — not carrier OTIF certification or engineered labor standards (same doc).
- KPIs are **operational**, not **financial close** — same disclaimer as on the home page.
