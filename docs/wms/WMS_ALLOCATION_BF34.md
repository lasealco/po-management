# BF-34 — MILP-style solver prototype (minimal)

**Purpose:** Optional **enumeration-backed** slot assignment for automated pick waves — behind an explicit env gate — without shipping OR-Tools/CP-SAT binaries or labor heatmaps.

## Landed slice

| Item | Detail |
|------|--------|
| **Strategies** | **`SOLVER_PROTOTYPE_MIN_BIN_TOUCHES`**, **`SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE`** |
| **Semantics** | Per outbound line, among positive **`WavePickSlot`** rows (bin × lot bucket), search the **smallest cardinality subset** whose summed **`available`** covers **`R`** (exact search when row count ≤ **`SOLVER_PROTOTYPE_MAX_SLOTS_FOR_EXACT`** = 14). Ties: **lexicographic** first subset in index space after sorting slots by **`isCrossDockStaging` desc**, then `(binCode, binId, lotCode)` (**BF-37**). Then run **BF-15** or **BF-23** ordering **only on that subset** (same pick sequencing as greedy, narrower candidate pool). Larger instances **fall back** to BF-15/BF-23 on **all** slots (deterministic). |
| **Implementation** | **`src/lib/wms/pick-wave-solver-prototype.ts`** · **`create_pick_wave`** branch · Vitest **`pick-wave-solver-prototype.test.ts`**. |
| **Feature flag** | **`WMS_ENABLE_BF34_SOLVER=1`** required for **`set_warehouse_pick_allocation_strategy`** and **`create_pick_wave`** to accept solver strategies. |

## Limits

- Not a general MILP solver; integer **subset cardinality** only, bounded enumeration.  
- **FEFO** warehouses still pass dated lot rows as distinct slots — wide SKU spreads hit the fallback quickly.  

## References

- [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)  
- [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-34  
