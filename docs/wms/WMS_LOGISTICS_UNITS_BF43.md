# BF-43 — GS1 license plate & nested outbound logistics units

**Scope:** Tenant-scoped **`WmsOutboundLogisticsUnit`** rows attached to an **`OutboundOrder`**, optional **`parentUnitId`** hierarchy (pallet → case → …), optional binding to **`OutboundOrderLine`** via **`outboundOrderLineId`** + **`containedQty`**.

**Pack / ship scan hook (BF-29):** `validate_outbound_pack_scan`, `mark_outbound_packed`, and `mark_outbound_shipped` resolve logistics units for the order and run **`verifyOutboundPackScanWithLogisticsUnits`** (`src/lib/wms/outbound-logistics-unit-scan.ts`). A scan matching a unit’s normalized **`scanCode`** whose line binding + positive **`containedQty`** is present consumes **`floor(containedQty)`** slots from the multiset of that line’s **`primaryPackScanCode`** (SKU → product code → product id). Units without a line/qty are structural only: scanning them does **not** consume picks unless the token coincidentally matches a product identifier.

**Normalization:** Numeric wedge input keeps the **last 18 digits** as the SSCC-style core (GS1 AI noise tolerant); other tokens use the same uppercase / whitespace normalization as BF-29 **`normalizePackScanToken`**.

**API (`POST /api/wms`):**

- **`upsert_outbound_logistics_unit_bf43`** — `outboundOrderId`, `logisticsUnitScanCode`, optional `logisticsUnitId` (update), `logisticsUnitKind`, optional `logisticsUnitParentId`, optional `logisticsOutboundOrderLineId` + required **`logisticsContainedQty`** when the line is set. Blocks parent cycles and duplicate scan codes per order.
- **`delete_outbound_logistics_unit_bf43`** — `outboundOrderId`, `logisticsUnitId`.

**Read model:** `GET /api/wms` includes **`logisticsUnits`** per outbound (flat list with `parentUnitId`). Operations UI lists/edits units under **BF-43 · Logistics units**.

**Out of scope:** Full EPCIS event registry, carton-level contents beyond multiset substitution, mixed-SKU inner packs.
