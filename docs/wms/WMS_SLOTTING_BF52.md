# Slotting ABC / velocity recommendations — BF-52 (minimal)

**Purpose:** Read-only **advisory** bin-move hints from **outbound pick velocity** and **`WarehouseBin.isPickFace`** — no automatic putaway tasks, no solver.

## API

- **`GET /api/wms/slotting-recommendations`** — JSON (default) or **`format=csv`**.
- **Query:** **`warehouseId`** (or **`wh`**, required), **`days`** (optional, default `30`, max `365`).
- **Auth:** **`org.wms` → view** (same as dashboard `GET /api/wms`).

## Methodology (implementation)

1. For the warehouse and rolling window, sum **`|quantity|`** of **`InventoryMovement`** rows with **`movementType=PICK`** per **`productId`** (warehouse-scoped).
2. **ABC classes** — sort SKUs by pick volume descending; walk **cumulative share of total pick volume** with default thresholds **80% / 95%** (see **`assignAbcByPickVolume`** in `slotting-recommendations.ts`). SKUs with **no picks** in the window default to **C** for location rules.
3. Scan **`InventoryBalance`** rows with **`onHandQty > 0`** (skip inactive or **`QUARANTINE`** bins).
4. **Recommendations**
   - **A/B** SKU in a **non-pick-face** bin → **`A_SKU_OFF_PICK_FACE`** / **`B_SKU_OFF_PICK_FACE`** → suggest **pick-face** bin with lightest **balance-row count** (tie-break by bin code).
   - **C** SKU in a **pick-face** bin (and bin is not **`STAGING`**) → **`C_SKU_ON_PICK_FACE`** → suggest **PALLET** or **FLOOR** bulk bin (same lightest-load heuristic).
5. **Priority score** — base score by reason + small bump from pick volume (bounded).

## UI

**`/wms/setup`** — **Slotting recommendations (BF-52)** panel: window days, **Load preview**, **Download JSON**, **Download CSV**. Adjacent **BF-86** panel (**Capacity utilization snapshot**) uses the same window for bin-level velocity heat — [`WMS_CAPACITY_UTILIZATION_BF86.md`](./WMS_CAPACITY_UTILIZATION_BF86.md).

## Out of scope (explicit)

- Robot / MILP slotting, labor heatmaps, unified replenishment solver (**BF-35** merge), automatic task creation from recommendations.

---

_Last updated: 2026-05-03 — BF-52 minimal advisory export + Setup preview._
