# STO landed-cost / FX notes stub — BF-78 (minimal)

**Purpose:** Optional **`bf78.v1`** JSON on **`WmsStockTransfer`** for **finance narrative** (landed-cost commentary + advisory FX pair/rate text) alongside **BF-55** ledger movements — not ERP cost absorption.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-78; builds on [`WMS_STOCK_TRANSFER_BF55.md`](./WMS_STOCK_TRANSFER_BF55.md).

## Schema

- **`WmsStockTransfer.landedCostNotesBf78Json`** — nullable JSON: **`schemaVersion`** (`bf78.v1`), **`notes`**, **`fxBaseCurrency`** / **`fxQuoteCurrency`** (ISO 4217, pair required together), optional **`fxRate`**, **`fxRateSourceNarrative`**.

## POST (`/api/wms`)

| Action | Tier | Purpose |
|--------|------|---------|
| **`set_wms_stock_transfer_landed_cost_notes_bf78`** | operations | Upsert narrative from **`stockTransferLandedCostNotesBf78`**; or **`landedCostNotesBf78Clear: true`** → JSON null. **`stockTransferId`** required. |
| **`create_wms_stock_transfer`** | operations | Optional **`stockTransferLandedCostNotesBf78`** on create (same shape as set). |

## GET

- **`GET /api/wms`** — each **`stockTransfers`** row includes **`landedCostNotesBf78`** (parsed doc or null) and **`landedCostNotesBf78Notice`** when stored JSON failed validation at read time.
- **`GET /api/wms/stock-transfer-export`** — **`bf78.v1`** JSON (default) or **`format=csv`** with landed-cost / FX columns; optional **`warehouseId`** / **`wh`** (source or destination filter), **`limit`** (1–500, default 200).

## UI

- **`/wms` operations** — **Stock transfer orders** panel: per-transfer **Landed cost / FX notes (BF-78)** form + **Export STO CSV** link.

## Out of scope

ERP absorption postings, automated landed-cost allocation engines, multi-leg ocean STO costing.

_Last updated: 2026-04-29 — BF-78 minimal slice._
