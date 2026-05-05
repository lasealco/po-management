# Stock transfer orders & in-transit ledger — BF-55 (minimal)

**Purpose:** **Inter-warehouse stock transfer orders (STO)** with explicit **in-transit** state: ship from a source bin (**`STO_SHIP`** movement), receive into a destination bin (**`STO_RECEIVE`** movement) — mirroring common ERP STO flows without landed cost or multi-leg ocean planning.

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-55; catalog [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md).

---

## What shipped

| Piece | Details |
|-------|---------|
| **Schema** | `WmsStockTransfer` + `WmsStockTransferLine`; `InventoryMovementType` adds **`STO_SHIP`**, **`STO_RECEIVE`**. |
| **Lifecycle** | `DRAFT` → `RELEASED` → `IN_TRANSIT` (after ship) → `RECEIVED`; `CANCELLED` from `DRAFT` / `RELEASED` only. |
| **POST** | `create_wms_stock_transfer` ( **`fromWarehouseId`**, **`toWarehouseId`**, **`stockTransferLines`** `{ productId, fromBinId, quantity, lotCode? }`, optional **`stockTransferLandedCostNotesBf78`** — BF-78 ); `release_wms_stock_transfer`; `cancel_wms_stock_transfer`; `set_wms_stock_transfer_line` ( **`stockTransferLineId`**, **`targetBinId`** ); `ship_wms_stock_transfer`; `receive_wms_stock_transfer`; **`set_wms_stock_transfer_landed_cost_notes_bf78`** — all **operations** tier. |
| **Ledger** | Movements use `referenceType: WMS_STOCK_TRANSFER`, `referenceId: transfer.id`. |
| **Payload** | `GET /api/wms` includes **`stockTransfers`** (open + recent **RECEIVED**); **BF-78** adds **`landedCostNotesBf78`** / **`landedCostNotesBf78Notice`** ([`WMS_STO_LANDED_COST_BF78.md`](./WMS_STO_LANDED_COST_BF78.md)). |
| **Home KPIs** | `fetchWmsHomeKpis.stockTransfersInTransit` (count of **`IN_TRANSIT`** headers; warehouse scope = touches source or destination). |

## UI

- **`/wms` operations** — **Stock transfer orders (BF-55)** workflow panel (create draft, release, ship, set receive bins, receive); **BF-78** landed-cost / FX notes per STO + **Export STO CSV** link.
- **`/wms` home** — **STOs in transit** executive card.

## Out of scope

Multi-leg transfers, in-transit **inventory rows** (in-transit is the transfer document + movements, not a third balance bucket), ERP landed-cost postings (**BF-78** covers narrative stub only), partial receive beyond the minimal single receive, carrier integration.

---

_Last updated: 2026-04-29 — BF-55 minimal slice + **BF-78** STO landed-cost notes cross-ref._
