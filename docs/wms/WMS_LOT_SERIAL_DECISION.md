# WMS lots — decision & MVP slice

## Decision

Reuse **`Product`** for SKU identity (shared PO/catalog master — **no separate lot-master table** in Phase A).

**Lot segmentation is modeled on `InventoryBalance`:**

| Approach | Notes |
|----------|--------|
| **Chosen:** optional **`lotCode`** on **`InventoryBalance`** | Batch bucket within **warehouse + bin + SKU**. Empty string (`""`) means **fungible / legacy** stock — exactly **one** bucket row per **warehouse · bin · product** without batch granularity. Non-empty codes split inventory while retaining shared **`Product`**. |

Full serialization (unique IDs per unit across lifecycle, cradle-to-grave genealogy) is **not** implemented here — blueprint serialization gaps remain backlog unless modeled via inventory granularity elsewhere.

## BF-02 — lot/batch master (minimal)

**[`WmsLotBatch`](./WMS_LOT_BATCH_BF02.md)** adds optional **expiry / country of origin / notes** keyed by **`tenantId` + `productId` + `lotCode`**, aligned with `InventoryBalance.lotCode`. This does **not** replace balance buckets; it annotates them for QA / regulatory visibility.

## MVP behavior

- **Putaway complete:** optional `lotCode` on `complete_putaway_task` creates/increments the matching bucket (`normalizeLotCode`).
- **Manual pick (`create_pick_task`):** optional `lotCode` resolves **`allocatedQty`** / decrement against that bucket.
- **Automated waves (`create_pick_wave`):** only allocates **`lotCode === ''`** rows (fungible). Lot-specific buckets require explicit picks until future allocation rules (e.g. FEFO) land.
- **Replenishment automation:** still fungible-only (`lotCode ''`).
- **Wave picks / release:** tasks carry `lotCode`; wave completion resolves balances consistently.

See **`normalizeLotCode`** / **`FUNGIBLE_LOT_CODE`** in `src/lib/wms/lot-code.ts`.

## Limitations (honest)

- **Expiry / origin / notes:** **`WmsLotBatch`** (BF-02) — optional master attributes; balances still keyed by `lotCode` string only.
- No SN-per-unit table — document-only deferral for blueprint serialization depth.
