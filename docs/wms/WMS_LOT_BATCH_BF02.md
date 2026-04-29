# BF-02 — Lot / batch master (minimal slice)

**Goal:** Move beyond **balance-only** `lotCode` strings by adding a **tenant + SKU + lotCode** registry row for **regulatory / ops metadata** (expiry, country of origin, free-text notes). **`InventoryBalance.lotCode`** remains the physical bucket key in bins; **no per-unit serial table** in this slice (see [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md)).

## Schema

| Table / field | Role |
|---------------|------|
| **`WmsLotBatch`** | `tenantId` + `productId` + `lotCode` (unique); optional `expiryDate` (`DATE`), `countryOfOrigin`, `notes`. |

Deleting a batch row does **not** delete balances; balances may still reference the same `lotCode` string without a matching master row (metadata simply absent in UI).

## API

| Action | Purpose |
|--------|---------|
| **`POST /api/wms`** `action: "set_wms_lot_batch"` | Upsert attributes for `(productId, lotCode)`. Body: `productId`, `lotCode` (required, non-empty after normalize); optional `batchExpiryDate`, `batchCountryOfOrigin`, `batchNotes` — omit field to leave unchanged; **`null` or `""` clears** for provided optional fields (expiry uses ISO date strings). |

**Audit:** `CtAuditLog` — `entityType`: **`WMS_LOT_BATCH`**, `action`: **`lot_batch_upserted`**.

## Read model

`GET /api/wms` includes:

- **`lotBatches`** — up to **500** rows (tenant + product scope), newest `updatedAt` first.
- **`balances[]`** — optional **`lotBatchProfile`** `{ expiryDate, countryOfOrigin, notes }` when a master row exists for that balance’s `product` + normalized `lotCode`.

## UI

**Stock** tab — **Lot / batch master (BF-02)** workflow panel: register/edit rows; **Stock balances** table adds **Expiry** and **COO** columns when profiles exist.

## Residual backlog

- Per-unit **serial genealogy** (`SN` table, parent/child) — still deferred.
- **Auto-link** inbound receipt lines to lot master — optional future field on `ShipmentItem`; not required for BF-02 exit.
