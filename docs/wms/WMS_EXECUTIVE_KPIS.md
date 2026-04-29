# WMS executive KPIs (WE-09)

**Purpose:** Agreed leadership-facing metrics for **`/wms`** “At a glance” vs blueprint-style dashboards — implemented as **operational tiles + executive highlights + optional JSON export**, not as a separate BI warehouse.

**Agreement:** These KPIs prioritize **floor-to-leadership alignment** (receiving, dock, VAS, inventory quality) using tables already in repo (`Shipment.wmsReceiveStatus`, `WmsDockAppointment`, `WmsTask`, `InventoryBalance`). Full blueprint OTIF / labor productivity / slotting analytics remain **out of scope** here unless modeled elsewhere.

## KPI inventory

| KPI | Definition | Primary sources |
|-----|------------|-----------------|
| **Receiving pipeline** | Count of inbound **`Shipment`** rows whose **`wmsReceiveStatus`** is one of `EXPECTED`, `AT_DOCK`, `RECEIVING`, `DISCREPANCY` (active receiving work not yet terminal). | `Shipment` + `PurchaseOrder.tenantId` |
| **Dock windows (today)** | Count of **`WmsDockAppointment`** rows with **`status = SCHEDULED`** whose window overlaps the **UTC** calendar day containing “now”. | `WmsDockAppointment` |
| **Open VAS workload** | Count of **`WmsTask`** rows with **`taskType = VALUE_ADD`** and **`status = OPEN`**. | `WmsTask` |
| **Hold rate (% of rows)** | `onHold` balance rows ÷ total balance rows × 100, **one decimal**, **0%** if no rows. | `InventoryBalance` |

### Operational tiles (triage)

unchanged from prior **`WmsHomeOverview`** behavior: open tasks by type (including **Open VAS tasks** as its own tile), outbound in flight, active waves, balance rows, on-hold balances, unbilled billing events, movements in last 7 days.

### Confidence signals

Three derived signals remain: **task pressure** (threshold bands on open tasks), **stock quality holds** (any on-hold vs clear), **ledger velocity** (7d movement count).

## Where it surfaces

| Surface | Notes |
|---------|--------|
| **`/wms`** | **Executive highlights** row + tiles + confidence signals (`src/components/wms-home-overview.tsx`). |
| **`GET /api/wms?homeKpis=1`** | Same KPI payload as JSON for integrations/scripts (`org.wms` **view** gate). Full dashboard payload is unchanged: **`GET /api/wms`** without this flag. |

Implementation: **`src/lib/wms/wms-home-kpis.ts`** (`fetchWmsHomeKpis`).

## Caveats

- **Dock “today”** uses **UTC** midnight boundaries — align reporting TZ in a future slice if leadership requires local-site midnight.
- Counts are **tenant-wide**, not warehouse-filtered; aligning with a selected warehouse is a future UX slice.
- KPIs are **operational**, not **financial close** — same disclaimer as on the home page.
