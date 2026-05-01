# BF-23 — Labor/layout-aware allocation (minimal)

**Purpose:** Extend automated wave allocation (**BF-15**) with a **deterministic labor-proxy** heuristic — without MILP, carton cube geometry, or workforce heatmaps.

## Landed slice

| Item | Detail |
|------|--------|
| **Strategy** | **`GREEDY_RESERVE_PICK_FACE`** on **`WmsPickAllocationStrategy`** |
| **Semantics** | Same **min bin touches** ordering as **`GREEDY_MIN_BIN_TOUCHES`** (full-cover bins first, smallest sufficient among covers, larger partials next). **Tie-break:** prefer **`WarehouseBin.isPickFace === false`** before pick-face bins — drain bulk/reserve locations before forward pick faces. |
| **Implementation** | **`orderPickSlotsMinBinTouchesReservePickFace`** in **`src/lib/wms/allocation-strategy.ts`**; **`create_pick_wave`** passes **`isPickFace`** from balances + bin metadata for fungible and FEFO branches. |
| **Setup UI** | WMS Setup → pick allocation strategy dropdown includes BF-23 option. |
| **Feature flag** | Omit **`GREEDY_RESERVE_PICK_FACE`** from **`set_warehouse_pick_allocation_strategy`** allowed values and block **`create_pick_wave`** when **`WMS_DISABLE_BF23_STRATEGY=1`**. |

## Explicit backlog

- MILP / integer programs for slotting or batching  
- Carton **cube** / dimensions on **`Product`** or UM  
- Labor capacity, travel-time matrices, real-time heatmaps  

## References

- [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)  
- [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-23  
