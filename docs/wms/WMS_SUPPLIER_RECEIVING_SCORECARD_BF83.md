# Supplier receiving scorecard export — BF-83

**Purpose:** Roll up **standard inbound** PO-linked **`Shipment`** receipts into OTIF-style KPIs and BF-01 **variance disposition** counts — grouped by **PO supplier**, **carrier supplier / free-text carrier**, or **shipment CRM customer** — for lightweight **SRM / carrier review** CSV handoff.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-83; shipment visibility [**`loadWmsViewReadScope` → `controlTowerShipmentAccessWhere`**](../../src/lib/wms/wms-read-scope.ts); line variance [**BF-01**](./WMS_RECEIVING_LINE_VARIANCE_BF01.md).

---

## Scope

| Rule | Detail |
|------|--------|
| Movements | **`Shipment`** rows with **`receivedAt`** in the query window (physical receipt timestamp). |
| Subtype | **`wmsInboundSubtype = STANDARD`** only (excludes **BF-41** customer returns). |
| Read scope | Same **`Shipment`** visibility as other WMS/API reads (supplier portal + org PO scope + optional CRM customer portal filter). |

---

## Metrics (`bf83.v1`)

Per group:

| Field | Meaning |
|-------|---------|
| **`shipmentsReceived`** | Count of qualifying shipments. |
| **`shipmentsWithExpectedArrival`** | Subset with **`expectedReceiveAt`** set (OTIF denominator). |
| **`shipmentsOnTime`** | **`receivedAt <= expectedReceiveAt`** when ETA exists. |
| **`pctOnTime`** | `shipmentsOnTime / shipmentsWithExpectedArrival` (percent, 2 decimals). |
| **`shipmentsOtif`** | ETA exists **and** on-time **and** every line is “in full”: no **`SHORT`** / **`DAMAGED`** disposition and **`quantityReceived >= quantityShipped`**. |
| **`pctOtif`** | `shipmentsOtif / shipmentsWithExpectedArrival`. |
| Line disposition counts | Tallies of **`ShipmentItem.wmsVarianceDisposition`** (**`MATCH`**, **`SHORT`**, **`OVER`**, **`DAMAGED`**, **`OTHER`**, **`UNSET`**). |
| **`sumQtyShipped`**, **`sumQtyReceived`**, **`fillRatePct`** | Line qty sums and **`received/shipped`** ratio (percent). |

---

## API

**`GET /api/wms/supplier-receiving-scorecard`**

| Query | Default | Notes |
|-------|---------|-------|
| **`since`**, **`until`** | `until` = now, **`since`** = 90 days earlier | ISO-8601; span ≤ **366** days. |
| **`groupBy`** | `supplier` | `supplier` \| `carrier` \| `customer` |
| **`format`** | JSON | `csv` → attachment |

**Grant:** **`org.wms`** · **view**

---

## UI

**Operations → Inbound / ASN:** quick links for **Supplier CSV**, **Carrier CSV**, and **CRM customer JSON** (rolling **90** days).

---

## Implementation

- [`src/lib/wms/supplier-receiving-scorecard-bf83.ts`](../../src/lib/wms/supplier-receiving-scorecard-bf83.ts)
- [`src/app/api/wms/supplier-receiving-scorecard/route.ts`](../../src/app/api/wms/supplier-receiving-scorecard/route.ts)

---

## Tests

[`src/lib/wms/supplier-receiving-scorecard-bf83.test.ts`](../../src/lib/wms/supplier-receiving-scorecard-bf83.test.ts)

---

## Out of scope

- Carrier tender optimization, negotiated ETAs, or external OTIF benchmarks.
- Persisted scorecard tables / trending warehouses (re-run export for snapshots).
