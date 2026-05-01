# WMS pick allocation strategies (WE-03) + BF-03 FEFO + BF-15 wave v2 + BF-23 reserve pick face (minimal)

**Status:** Implemented policy slice · **Last updated:** 2026-05-03

## What ships

Per-**warehouse** enum **`WmsPickAllocationStrategy`** on `Warehouse.pickAllocationStrategy`:

| Strategy | Automated `create_pick_wave` | Manual `create_pick_task` |
|----------|------------------------------|---------------------------|
| **`MAX_AVAILABLE_FIRST`** | Yes — bins ordered by **descending available** (free stock), then bin code tie-break · **fungible (`lotCode ''`) balances only** | Always allowed — operator picks bin/lot |
| **`FIFO_BY_BIN_CODE`** | Yes — bins ordered by **`WarehouseBin.code`** (ascending), then stable bin id · **fungible only** | Always allowed |
| **`FEFO_BY_LOT_EXPIRY`** (**BF-03**) | Yes — considers **all** lot buckets in the warehouse; orders slots by earliest **`WmsLotBatch.expiryDate`** (missing registry → sort before fungible; **fungible last**), then bin code + lot code | Always allowed |
| **`GREEDY_MIN_BIN_TOUCHES`** (**BF-15**) | Yes — **fungible only** (same balance fetch as MAX/FIFO). Slot **globally** sorted by bin code for determinism; **per outbound line**, bins are re-ordered so those that can cover the **remaining** line qty in **one** pick task are tried first, then descending available — heuristic for fewer bin visits | Always allowed |
| **`GREEDY_RESERVE_PICK_FACE`** (**BF-23**) | Yes — **fungible only**, same slot fetch as BF-15; uses **`orderPickSlotsMinBinTouchesReservePickFace`** so ties prefer **non–pick-face** bins first (`WarehouseBin.isPickFace`), reserving forward pick faces until bulk bins are exhausted | Always allowed unless deployment sets **`WMS_DISABLE_BF23_STRATEGY=1`** |
| **`MANUAL_ONLY`** | **Blocked** (HTTP 400) — no silent multi-bin wave allocation | **Required path** for reservations |

**BF-15 — Optional carton / task cap:** nullable **`Warehouse.pickWaveCartonUnits`** (`Decimal`, units per SKU line pick task). When set (> 0), **`create_pick_wave`** clamps each automated pick task quantity to **≤ cap** (applies to **all** non-`MANUAL_ONLY` strategies). Configure via **`POST /api/wms`** **`set_warehouse_pick_wave_carton_units`** (`warehouseId`, `pickWaveCartonUnits`: positive number **or** `null` to clear). WMS Setup → **Pick allocation policy** shows strategy + cap controls.

Setting strategy is **`set_warehouse_pick_allocation_strategy`** (`warehouseId`, `pickAllocationStrategy`). **`org.wms` → edit** or **`org.wms.setup` → edit** applies (tier map).

## BF-03 behavior details

- **`FEFO_BY_LOT_EXPIRY`** wave builder loads **`InventoryBalance`** rows for the warehouse (every `lotCode`), joins expiry via **`WmsLotBatch`** (`tenantId` + `productId` + normalized `lotCode`).
- Non-fungible row **without** a `WmsLotBatch` row sorts with **`expirySortMs = MAX_SAFE_INTEGER - 1`** (after dated lots, before fungible).
- **Fungible** buckets (`lotCode ''`) sort **last** so dated inventory consumes first.
- Pick tasks and reservations reference the **`slot.lotCode`** from allocation (same as balance row).

## BF-15 behavior details

- **`GREEDY_MIN_BIN_TOUCHES`** does **not** allocate dated lots — use **`FEFO_BY_LOT_EXPIRY`** when expiry-driven consumption matters.
- Among bins that **fully cover** the line remainder, the heuristic prefers the **smallest sufficient** on-hand chunk first (keeps consolidated stock in larger bins); among bins that only partially cover, it prefers **larger** available balances next.
- **`pickWaveCartonUnits`** splits large picks into multiple wave tasks (same bin may appear in successive tasks if remainder > cap).
- Pure helpers: **`orderPickSlotsMinBinTouches`** + **`orderPickSlotsForWave`** in **`src/lib/wms/allocation-strategy.ts`**.

## BF-23 behavior details

- **`GREEDY_RESERVE_PICK_FACE`** applies only when the warehouse strategy is set to this enum value — **same fungible-only scope as BF-15** (not a substitute for **`FEFO_BY_LOT_EXPIRY`**).

## Tests & module

Vitest: **`allocation-strategy.test.ts`** covers **`orderPickSlotsForWave`** (including greedy baseline sorts) and **`orderPickSlotsMinBinTouches`** + **`orderPickSlotsMinBinTouchesReservePickFace`**.

## Human approval / “no silent moves”

- **Wave allocation** is never silent to policy: it runs only under an explicit warehouse strategy; **`MANUAL_ONLY`** forbids automated waves so every **`allocatedQty`** increment from waves requires switching strategy first or using manual picks.
- **Manual pick tasks** remain explicitly bin-selected (human path).
- **`complete_wave`** / **`complete_pick_task`** still require **explicit operator actions** (existing workflow); they are not background automation.

## Limits (honest 🟡)

No MILP solver, no labor heatmaps, no carton **cube** / dimensions — **BF-15** adds deterministic **min-touch greedy** ordering plus an optional **unit cap** per wave pick task; **BF-23** adds pick-face **reserve** tie-break only. Multi-wave optimizers and packing physics stay future work ([`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md)).
