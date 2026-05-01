# BF-33 — Carton DIM / cube-aware greedy allocation (minimal)

**Purpose:** Extend **BF-15** / **BF-23** wave heuristics with a **soft cube-feasibility tier** when SKU carton hints and optional bin capacity hints exist — without MILP (**BF-34**) or conveyor physics.

## Landed slice

| Item | Detail |
|------|--------|
| **Strategies** | **`GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE`**, **`GREEDY_RESERVE_PICK_FACE_CUBE_AWARE`** on **`WmsPickAllocationStrategy`** |
| **Semantics** | Same greedy ordering as BF-15 / BF-23 after a **cube tier**: when **`Product`** carton L/W/H (mm) yield a master-carton cube and **`estimatePickCubeMm3`** is defined for the line remainder, bins whose **`WarehouseBin.capacityCubeCubicMm`** is **known and smaller** than that estimate sort **last**. Missing bin capacity or missing carton dims → tier is neutral (falls back to BF-15 / BF-23 only). |
| **Implementation** | **`src/lib/wms/carton-cube-allocation.ts`** (`estimatePickCubeMm3`, `orderPickSlotsMinBinTouchesCubeAware`, `orderPickSlotsMinBinTouchesReservePickFaceCubeAware`); **`create_pick_wave`** loads **`capacityCubeCubicMm`** and line **`product`** carton fields. |
| **Payload** | **`GET /api/wms`** exposes carton hints on product refs, **`bins[].capacityCubeCubicMm`**, **`outboundOrders[].estimatedCubeCbm`**. |
| **Mutations** | **`set_product_carton_cube_hints`**, **`set_outbound_order_cube_hint`**; **`create_bin`** / **`update_bin_profile`** accept **`capacityCubeCubicMm`**. |
| **Feature flag** | Block **`create_pick_wave`** for cube-aware strategies when **`WMS_DISABLE_BF33_CUBE_AWARE=1`**; omit those enum values from **`set_warehouse_pick_allocation_strategy`** when set. |

## References

- [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)  
- [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-33  
