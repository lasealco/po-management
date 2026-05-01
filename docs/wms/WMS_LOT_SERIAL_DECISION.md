# WMS lots — decision & MVP slice

## Decision

Reuse **`Product`** for SKU identity (shared PO/catalog master — **no separate lot-master table** in Phase A).

**Lot segmentation is modeled on `InventoryBalance`:**

| Approach | Notes |
|----------|--------|
| **Chosen:** optional **`lotCode`** on **`InventoryBalance`** | Batch bucket within **warehouse + bin + SKU**. Empty string (`""`) means **fungible / legacy** stock — exactly **one** bucket row per **warehouse · bin · product** without batch granularity. Non-empty codes split inventory while retaining shared **`Product`**. |

Full serialization at **lot/batch** granularity uses **`lotCode`** + optional **`WmsLotBatch`** metadata (BF-02). **Unit-level** serial genealogy is covered by **BF-13** below — not full GS1 aggregation.

## BF-02 — lot/batch master (minimal)

**[`WmsLotBatch`](./WMS_LOT_BATCH_BF02.md)** adds optional **expiry / country of origin / notes** keyed by **`tenantId` + `productId` + `lotCode`**, aligned with `InventoryBalance.lotCode`. This does **not** replace balance buckets; it annotates them for QA / regulatory visibility.

## BF-13 — unit serial registry (minimal)

**BF-13** introduces **`WmsInventorySerial`** (+ **`WmsInventorySerialMovement`**) — tenant-scoped **unique serial per SKU**, optional **`currentBalanceId`** pointer, and **manual links** to **`InventoryMovement`** rows for trace reads. API: **`register_inventory_serial`**, **`set_inventory_serial_balance`**, **`attach_inventory_serial_to_movement`** ( **`org.wms.inventory`** tier ); read hook: **`GET /api/wms`** with **`traceProductId`** + **`traceSerialNo`**. Does **not** auto-capture serials from putaway/pick/shipment handlers in v1; manufacturing-source and carrier ASN serialization remain out of scope.

## MVP behavior

- **Putaway complete:** optional `lotCode` on `complete_putaway_task` creates/increments the matching bucket (`normalizeLotCode`).
- **Manual pick (`create_pick_task`):** optional `lotCode` resolves **`allocatedQty`** / decrement against that bucket.
- **Automated waves (`create_pick_wave`):** only allocates **`lotCode === ''`** rows (fungible). Lot-specific buckets require explicit picks until future allocation rules (e.g. FEFO) land.
- **Replenishment automation:** still fungible-only (`lotCode ''`).
- **Wave picks / release:** tasks carry `lotCode`; wave completion resolves balances consistently.

See **`normalizeLotCode`** / **`FUNGIBLE_LOT_CODE`** in `src/lib/wms/lot-code.ts`.

## Limitations (honest)

- **Expiry / origin / notes:** **`WmsLotBatch`** (BF-02) — optional master attributes; balances still keyed by `lotCode` string only.
- **BF-13:** Serial registry is **operator-driven** (register / link / balance pointer); wave automation and ASN ingestion do not emit serial rows yet.
