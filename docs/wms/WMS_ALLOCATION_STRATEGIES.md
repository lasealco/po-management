# WMS pick allocation strategies (WE-03) + BF-03 FEFO slice

**Status:** Implemented policy slice · **Last updated:** 2026-04-29

## What ships

Per-**warehouse** enum **`WmsPickAllocationStrategy`** on `Warehouse.pickAllocationStrategy`:

| Strategy | Automated `create_pick_wave` | Manual `create_pick_task` |
|----------|-------------------------------|---------------------------|
| **`MAX_AVAILABLE_FIRST`** | Yes — bins ordered by **descending available** (free stock), then bin code tie-break · **fungible (`lotCode ''`) balances only** | Always allowed — operator picks bin/lot |
| **`FIFO_BY_BIN_CODE`** | Yes — bins ordered by **`WarehouseBin.code`** (ascending), then stable bin id · **fungible only** | Always allowed |
| **`FEFO_BY_LOT_EXPIRY`** (**BF-03**) | Yes — considers **all** lot buckets in the warehouse; orders slots by earliest **`WmsLotBatch.expiryDate`** (missing registry → sort before fungible; **fungible last**), then bin code + lot code | Always allowed |
| **`MANUAL_ONLY`** | **Blocked** (HTTP 400) — no silent multi-bin wave allocation | **Required path** for reservations |

Setting strategy is **`POST /api/wms`** action **`set_warehouse_pick_allocation_strategy`** (`warehouseId`, `pickAllocationStrategy`). **`org.wms` edit** applies like other POST actions.

## BF-03 behavior details

- **`FEFO_BY_LOT_EXPIRY`** wave builder loads **`InventoryBalance`** rows for the warehouse (every `lotCode`), joins expiry via **`WmsLotBatch`** (`tenantId` + `productId` + normalized `lotCode`).
- Non-fungible row **without** a `WmsLotBatch` row sorts with **`expirySortMs = MAX_SAFE_INTEGER - 1`** (after dated lots, before fungible).
- **Fungible** buckets (`lotCode ''`) sort **last** so dated inventory consumes first.
- Pick tasks and reservations reference the **`slot.lotCode`** from allocation (same as balance row).

## Tests & module

Pure ordering logic lives in **`src/lib/wms/allocation-strategy.ts`** (`orderPickSlotsForWave`, `WavePickSlot`) with Vitest in **`allocation-strategy.test.ts`**.

## Human approval / “no silent moves”

- **Wave allocation** is never silent to policy: it runs only under an explicit warehouse strategy; **`MANUAL_ONLY`** forbids automated waves so every **`allocatedQty`** increment from waves requires switching strategy first or using manual picks.
- **Manual pick tasks** remain explicitly bin-selected (human path).
- **`complete_wave`** / **`complete_pick_task`** still require **explicit operator actions** (existing workflow); they are not background automation.

## Limits (honest 🟡)

No carton-level optimization, no solver across waves or multi-objective allocation — **BF-03** adds **FEFO-by-expiry** for automated waves only; enterprise allocation engines stay future work.
