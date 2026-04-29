# WMS pick allocation strategies (WE-03)

**Status:** Implemented policy slice · **Last updated:** 2026-04-29

## What ships

Per-**warehouse** enum **`WmsPickAllocationStrategy`** on `Warehouse.pickAllocationStrategy`:

| Strategy | Automated `create_pick_wave` | Manual `create_pick_task` |
|----------|-------------------------------|---------------------------|
| **`MAX_AVAILABLE_FIRST`** | Yes — bins ordered by **descending available** (free stock), then bin code tie-break | Always allowed — operator picks bin |
| **`FIFO_BY_BIN_CODE`** | Yes — bins ordered by **`WarehouseBin.code`** (ascending), then stable bin id | Always allowed |
| **`MANUAL_ONLY`** | **Blocked** (HTTP 400) — no silent multi-bin wave allocation | **Required path** for reservations |

Setting strategy is **`POST /api/wms`** action **`set_warehouse_pick_allocation_strategy`** (`warehouseId`, `pickAllocationStrategy`). **`org.wms` edit** applies like other POST actions.

## Tests & module

Pure ordering logic lives in **`src/lib/wms/allocation-strategy.ts`** (`orderPickSlotsForWave`) with Vitest in **`allocation-strategy.test.ts`**.

## Human approval / “no silent moves”

- **Wave allocation** is never silent to policy: it runs only under an explicit warehouse strategy; **`MANUAL_ONLY`** forbids automated waves so every **`allocatedQty`** increment from waves requires switching strategy first or using manual picks.
- **Manual pick tasks** remain explicitly bin-selected (human path).
- **`complete_wave`** / **`complete_pick_task`** still require **explicit operator actions** (existing workflow); they are not background automation.

## Limits (honest 🟡)

No lot-level FEFO, no carton-level optimization, no solver across waves — three **staged profiles** only; enterprise multi-strategy engines stay future work.
